import express from "express";
import { getDomruInstanceFromToken, MOCK_PLACES, MOCK_DEVICES, isDemo } from "../domruClientHelper.js";
import { enableAutoOpen } from "../sip-manager.js";
import { getProxiedStreamUrl } from "../yandexHelper.js";

const router = express.Router();

function createResponse(text: string, endSession: boolean, state?: any, needAuth?: boolean) {
  const res: any = {
    response: {
      text,
      end_session: endSession,
    },
    version: "1.0",
  };

  if (state) {
    res.session_state = state;
  }

  if (needAuth) {
    res.response.directives = {
      start_account_linking: {}
    };
  }

  return res;
}

// POST /api/yandex/dialogs
router.post("/", async (req, res) => {
  try {
    const { request, session, state, version } = req.body;
    
    // 1. Check Account Linking (Auth)
    const accessToken = session?.user?.access_token || session?.application?.access_token || req.headers.authorization?.replace("Bearer ", "");
    
    if (!accessToken) {
      return res.json(createResponse("Пожалуйста, авторизуйтесь в приложении для использования навыка.", true, null, true));
    }

    // Mock Express Request to reuse existing token logic
    const mockReq = { headers: { authorization: `Bearer ${accessToken}` }, query: {} } as any;
    
    let client, userId;
    let isDemoMode = false;
    try {
      const authData = getDomruInstanceFromToken(mockReq);
      client = authData.client;
      userId = authData.userId;
      isDemoMode = authData.isDemo;
    } catch (e) {
      return res.json(createResponse("Ваш токен авторизации устарел. Пожалуйста, привяжите аккаунт заново.", true, null, true));
    }

    // Parse incoming command
    const command = request?.command?.toLowerCase() || "";
    const sessionState = state?.session || {};

    // First time opening the skill without a specific command
    if (session?.new && !command) {
      return res.json(createResponse("Привет! Я могу включить авто-открытие домофона. Вы ждете курьера или гостей?", false, { step: "INIT" }));
    }

    let currentStep = sessionState.step || "INIT";

    // Immediate fast-paths
    if (command.includes("курьер")) {
      await activateAutoOpen(client, isDemoMode, mockReq, 1, 120, "courier");
      return res.json(createResponse("Хорошо, включила ожидание курьера на 2 часа.", true));
    }

    const wordToNumber: Record<string, number> = {
      "одного": 1, "один": 1, "одна": 1, "одну": 1,
      "двух": 2, "два": 2, "двое": 2, "две": 2,
      "трех": 3, "три": 3, "троих": 3, "трое": 3,
      "четырех": 4, "четыре": 4, "четверых": 4, "четверо": 4,
      "пяти": 5, "пять": 5, "пятерых": 5, "пятеро": 5,
      "шести": 6, "шесть": 6, "шестерых": 6, "шестеро": 6,
      "семи": 7, "семь": 7, "семерых": 7, "семеро": 7,
      "восьми": 8, "восемь": 8, "восьмерых": 8, "восьмеро": 8,
      "девяти": 9, "девять": 9, "девятерых": 9, "девятеро": 9,
      "десяти": 10, "десять": 10, "десятерых": 10, "десятеро": 10,
    };

    const isGuestIntent = command.includes("гост") || currentStep === "WAITING_GUESTS_COUNT";
    const isJustNumber = /^\d+$/.test(command) || Object.keys(wordToNumber).includes(command);

    if (isGuestIntent || isJustNumber) {
      const match = command.match(/\d+/);
      let count = 0;
      
      if (match) {
        count = parseInt(match[0], 10);
      } else {
        for (const [word, num] of Object.entries(wordToNumber)) {
          if (command.includes(word)) {
            count = num;
            break;
          }
        }
      }

      // If they explicitly said "гостя" (singular) without a number, assume 1.
      if (count === 0 && command.includes("гостя")) {
        count = 1;
      }

      if (count === 1) {
        await activateAutoOpen(client, isDemoMode, mockReq, 1, 180, "guest");
        return res.json(createResponse("Поняла, ожидаю одного гостя в течение 3 часов.", true));
      } else if (count > 0) {
        await activateAutoOpen(client, isDemoMode, mockReq, count, 180, "guest");
        return res.json(createResponse(`Отлично. Включила ожидание для ${count} гостей на 3 часа.`, true));
      } else if (command.includes("безлимит") || command.includes("много")) {
        await activateAutoOpen(client, isDemoMode, mockReq, null, 180, "guest");
        return res.json(createResponse(`Хорошо. Включила безлимитное открытие дверей на 3 часа.`, true));
      } else {
        return res.json(createResponse("Сколько гостей вы ожидаете?", false, { step: "WAITING_GUESTS_COUNT" }));
      }
    }

    // Fallback
    return res.json(createResponse("Я могу помочь с авто-открытием домофона. Кого вы ожидаете: курьера или гостей?", false, { step: "INIT" }));

  } catch (error: any) {
    console.error("Yandex Dialogs Error:", error);
    res.json(createResponse("Произошла ошибка при настройке домофона.", true));
  }
});

// Helper function to find the first intercom and enable auto-open
async function activateAutoOpen(client: any, isDemoMode: boolean, mockReq: any, maxOpens: number | null, durationMinutes: number, explicitRole?: "guest" | "courier") {
  let places = [];
  let devicesByPlace: Record<number, any[]> = {};

  if (isDemoMode) {
    places = MOCK_PLACES;
    devicesByPlace = MOCK_DEVICES;
  } else {
    places = await client.getSubscriberPlaces();
    if (places.length > 0) {
      const targetPlaceId = places[0].place?.id || places[0].id;
      devicesByPlace[targetPlaceId] = await client.getDevices(targetPlaceId);
    }
  }

  if (places.length === 0) return;

  const placeId = places[0].place?.id || places[0].id;
  const devices = devicesByPlace[placeId] || [];
  
  // Find first device that can open door
  const intercom = devices.find((d: any) => d.allowOpen);
  if (!intercom) return;

  const deviceId = intercom.id;

  let credentials: any;
  if (isDemoMode) {
    credentials = { login: "demo", password: "123", realm: "demo.realm" };
  } else {
    const { randomBytes } = await import("crypto");
    const installationId = randomBytes(16).toString("hex");
    credentials = await client.getSipCredentials(Number(placeId), Number(deviceId), installationId);
  }

  const expiresAt = Date.now() + (durationMinutes * 60 * 1000);

  let domruCredentials;
  if (isDemoMode) {
    domruCredentials = { isDemo: true };
  } else {
    const ctx = (client as any).ctx;
    domruCredentials = {
      login: ctx?.login,
      password: ctx?.password,
      refreshToken: ctx?.refreshToken,
      operatorId: ctx?.operatorId,
      accessToken: ctx?.accessToken,
    };
  }

  enableAutoOpen({
    placeId: Number(placeId),
    deviceId: Number(deviceId),
    credentials,
    expiresAt,
    maxOpens,
    domruCredentials,
    onOpenDoor: async () => {
      if (!isDemoMode) {
        await client.openDoor(Number(placeId), Number(deviceId));
      } else {
        console.log(`[DEMO] Door opened via Yandex Dialogs for place ${placeId}, device ${deviceId}`);
      }
      const { recordDoorOpening } = await import("../openings-manager.js");
      recordDoorOpening(Number(placeId), Number(deviceId), "auto", "Голосовой ассистент Алиса");
    }
  });

  const { addTemporaryAutoOpenPerson } = await import("../people-manager.js");
  addTemporaryAutoOpenPerson(Number(deviceId), maxOpens, durationMinutes, explicitRole);
}

export default router;
