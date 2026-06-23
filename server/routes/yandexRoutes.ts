import express from "express";
import { registerCredentials } from "../tokenStore.js";
import { getRequestId, getProxiedStreamUrl } from "../yandexHelper.js";
import { getDomruInstanceFromToken, isDemo, MOCK_PLACES, MOCK_DEVICES, MOCK_CAMERAS } from "../domruClientHelper.js";
import { handleManualOpen } from "../sip-manager.js";

const router = express.Router();

// Register OAuth authorization credentials to get a short UUID code (prevents Yandex database truncation errors)
router.post("/oauth/register", (req, res) => {
  const creds = req.body;
  if (!creds || !creds.login) {
    return res.status(400).json({ error: "invalid_request", error_description: "Missing credentials" });
  }
  try {
    const code = registerCredentials(creds);
    res.json({ code });
  } catch (err: any) {
    console.error("[OAUTH_REGISTER] Failed to register credentials:", err);
    res.status(500).json({ error: "server_error", error_description: err.message });
  }
});

// Yandex OAuth2 Endpoint: Authorization Consent Page (serves premium UX in Russian with direct Demo mode option)
router.get("/oauth/authorize", (req, res) => {
  const clientId = req.query.client_id;
  const redirectUri = req.query.redirect_uri;
  const state = req.query.state;
  const responseType = req.query.response_type;

  if (!redirectUri) {
    return res.status(400).send("Bad request: missing redirect_uri");
  }

  const htmlContent = require('fs').readFileSync(require('path').join(process.cwd(), 'server', 'views', 'oauth-consent.html'), 'utf-8');
  res.send(htmlContent);
});

// Yandex OAuth2 Endpoint: Token Exchange and Token Refresh
router.post("/oauth/token", (req, res) => {
  const grantType = req.body.grant_type;
  const code = req.body.code;
  const refreshToken = req.body.refresh_token;

  if (grantType === "authorization_code") {
    if (!code) {
      return res.status(400).json({ error: "invalid_request", error_description: "Missing authorization code" });
    }
    res.json({
      access_token: "at_" + code,
      refresh_token: "rt_" + code,
      expires_in: 31536000 // 1 year expiration
    });
  } else if (grantType === "refresh_token") {
    if (!refreshToken) {
      return res.status(400).json({ error: "invalid_request", error_description: "Missing refresh_token" });
    }
    const freshCode = refreshToken.startsWith("rt_") ? refreshToken.substring(3) : refreshToken;
    res.json({
      access_token: "at_" + freshCode,
      refresh_token: "rt_" + freshCode,
      expires_in: 31536000
    });
  } else {
    res.status(400).json({ error: "unsupported_grant_type" });
  }
});

// Yandex Provider Endpoint: Ping (Head or Get /v1.0)
router.get("/v1.0", (req, res) => {
  res.setHeader("X-Request-Id", getRequestId(req));
  res.sendStatus(200);
});
router.head("/v1.0", (req, res) => {
  res.setHeader("X-Request-Id", getRequestId(req));
  res.sendStatus(200);
});

// Yandex Provider Endpoint: Unlink Account webhook
router.post("/v1.0/user/unlink", (req, res) => {
  res.setHeader("X-Request-Id", getRequestId(req));
  res.json({
    request_id: getRequestId(req)
  });
});

// Yandex Provider Endpoint: Devices Discovery webhook
router.get("/v1.0/user/devices", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Request-Id", requestId);

  try {
    const { client, isDemo: isDemoMode, userId } = getDomruInstanceFromToken(req);

    let places: any[] = [];
    let devicesByPlace: { [key: number]: any[] } = {};
    let cameras: any[] = [];

    if (isDemoMode) {
      places = MOCK_PLACES;
      devicesByPlace = MOCK_DEVICES;
      cameras = MOCK_CAMERAS;
    } else {
      try {
        places = await client.getSubscriberPlaces();
        await Promise.all(
          places.map(async (place) => {
            const targetPlaceId = place.place?.id || place.id;
            try {
              const devs = await client.getDevices(targetPlaceId);
              devicesByPlace[targetPlaceId] = devs;
            } catch (err) {
              console.error(`Yandex recovery: failed to fetch devices for place ${targetPlaceId}:`, err);
              devicesByPlace[targetPlaceId] = [];
            }
          })
        );
        try {
          cameras = await client.getCameras();
          if (cameras.length > 0) {
            console.log("[DISCOVERY] Camera object sample keys:", Object.keys(cameras[0] as any).join(", "));
            console.log("[DISCOVERY] Camera[0] raw:", JSON.stringify(cameras[0]).substring(0, 300));
          }
        } catch (err) {
          console.error("Yandex recovery: failed to fetch cameras list:", err);
          cameras = [];
        }
      } catch (err: any) {
        console.error("Yandex dynamic discovery fetch error:", err);
        const isAuthError = err.name === "AuthRequiredError" || 
                            err.name === "UnauthorizedError" || 
                            err.message?.includes("Auth") || 
                            err.message?.includes("Unauthorized") || 
                            err.statusCode === 401 || 
                            err.statusCode === 403;
        
        if (isAuthError) {
          return res.status(401).json({
            request_id: requestId,
            error: "invalid_token"
          });
        }
        return res.status(500).json({
          request_id: requestId,
          error: "Failed to communicate with Domru API"
        });
      }
    }

    const yandexDevices: any[] = [];

    // Map Intercom / Door / Gate physical openers
    for (const place of places) {
      const targetPlaceId = place.place?.id || place.id;
      const devs = devicesByPlace[targetPlaceId] || [];
      const address = place.place?.address?.visibleAddress || `Договор ${targetPlaceId}`;

      for (const dev of devs) {
        const deviceId = `device_${targetPlaceId}_${dev.id}`;
        let yandexType = "devices.types.openable";

        if (dev.type === "camera") {
          yandexType = "devices.types.camera";
        }

        yandexDevices.push({
          id: deviceId,
          name: dev.name || "Домофон",
          description: `Адрес: ${address}`,
          type: yandexType,
          room: address,
          capabilities: [
            {
              type: "devices.capabilities.on_off",
              retrievable: true,
              parameters: {
                split: false
              }
            }
          ],
          device_info: {
            manufacturer: "Forpost / Dom.ru",
            model: dev.type || "intercom",
            hw_version: "1.0",
            sw_version: "1.0"
          }
        });
      }
    }

    // Map CCTV Security Cameras
    for (const cam of cameras) {
      const rawCamId = (cam as any).ID ?? (cam as any).id ?? (cam as any).cameraId ?? (cam as any).externalId;
      if (!rawCamId) {
        console.warn("[DISCOVERY] Camera skipped — no id field found. Keys:", Object.keys(cam as any).join(", "));
        continue;
      }
      const camId = `camera_${rawCamId}`;
      const camName = (cam as any).Name ?? (cam as any).name ?? "Камера";
      const address = "Видеонаблюдение";

      yandexDevices.push({
        id: camId,
        name: camName,
        description: "IP-камера безопасности Forpost",
        type: "devices.types.camera",
        room: address,
        capabilities: [
          {
            type: "devices.capabilities.video_stream",
            retrievable: false,
            parameters: {
              protocols: ["hls"],
              audio_supported: true
            }
          }
        ],
        device_info: {
          manufacturer: "Forpost / Dom.ru",
          model: "CCTV Camera",
          hw_version: "1.0",
          sw_version: "1.0"
        }
      });
    }

    res.json({
      request_id: requestId,
      payload: {
        user_id: userId,
        devices: yandexDevices
      }
    });

  } catch (err: any) {
    console.error("Yandex discovery failure:", err);
    res.status(401).json({ request_id: requestId, error: "invalid_token" });
  }
});

// Yandex Provider Endpoint: Query state webhook
router.post("/v1.0/user/devices/query", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Request-Id", requestId);

  try {
    const { client, isDemo: isDemoMode } = getDomruInstanceFromToken(req);
    const devices = req.body.devices;

    if (!devices || !Array.isArray(devices)) {
      return res.status(400).json({ request_id: requestId, error: "invalid_request" });
    }

    const resDevices: any[] = [];

    for (const reqDev of devices) {
      const devId = reqDev.id;

      if (devId.startsWith("camera_")) {
        resDevices.push({
          id: devId
        });
      } else if (devId.startsWith("device_")) {
        resDevices.push({
          id: devId,
          capabilities: [
            {
              type: "devices.capabilities.on_off",
              state: {
                instance: "on",
                value: false
              }
            }
          ]
        });
      }
    }

    res.json({
      request_id: requestId,
      payload: {
        devices: resDevices
      }
    });

  } catch (err: any) {
    console.error("Yandex state query error:", err);
    res.status(401).json({ request_id: requestId, error: "invalid_token" });
  }
});

// Yandex Provider Endpoint: Execute command webhook
router.post("/v1.0/user/devices/action", async (req, res) => {
  const requestId = getRequestId(req);
  res.setHeader("X-Request-Id", requestId);

  console.log("[YANDEX_ACTION_REQ]", JSON.stringify(req.body, null, 2));

  try {
    const { client, isDemo: isDemoMode } = getDomruInstanceFromToken(req);
    const devices = req.body.payload?.devices;

    if (!devices || !Array.isArray(devices)) {
      return res.status(400).json({ request_id: requestId, error: "invalid_request" });
    }

    const resDevices: any[] = [];

    for (const reqDev of devices) {
      const devId = reqDev.id;
      const capabilities = reqDev.capabilities || [];
      const resCaps: any[] = [];

      for (const cap of capabilities) {
        if (cap.type === "devices.capabilities.video_stream" && cap.state?.instance === "get_stream") {
          const cameraId = devId.replace("camera_", "");
          let streamUrl = "";

          try {
            if (isDemoMode) {
              streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
            } else {
              const streamInfo = await client.getStreamUrl(cameraId);
              if (streamInfo?.url) {
                streamUrl = getProxiedStreamUrl(req, streamInfo.url, client);
              }
            }
          } catch (streamErr) {
            console.error(`[Yandex action] Failed to get stream for camera ${cameraId}:`, streamErr);
          }

          resCaps.push({
            type: "devices.capabilities.video_stream",
            state: {
              instance: "get_stream",
              action_result: { status: streamUrl ? "DONE" : "ERROR" },
              value: streamUrl ? { stream_url: streamUrl, protocol: "hls" } : undefined
            }
          });
          continue;
        }

        if (cap.type === "devices.capabilities.on_off") {
          const valve = cap.state?.value;
          let status = "DONE";
          let errCode = null;

          if (valve === true) {
            if (devId.startsWith("device_")) {
              const parts = devId.split("_");
              const placeId = Number(parts[1]);
              const deviceId = Number(parts[2]);

              if (!isDemoMode) {
                try {
                  await handleManualOpen(placeId, deviceId, client);
                  console.log(`[Yandex Alice] Open door handled for place ${placeId}, device ${deviceId}`);
                } catch (errByDomru) {
                  console.error(`[Yandex Alice] Open door failed for place ${placeId}, device ${deviceId}:`, errByDomru);
                  status = "ERROR";
                  errCode = "DEVICE_UNREACHABLE";
                }
              } else {
                console.log(`[Yandex Alice Demo] Mock open command triggered for ${devId}`);
              }
            }
          }

          const capRes: any = {
            type: "devices.capabilities.on_off",
            state: {
              instance: "on",
              action_result: {
                status: status
              }
            }
          };

          if (errCode) {
            capRes.state.action_result.error_code = errCode;
          }

          resCaps.push(capRes);
        }
      }

      resDevices.push({
        id: devId,
        capabilities: resCaps
      });
    }

    const responsePayload = {
      request_id: requestId,
      payload: {
        devices: resDevices
      }
    };

    console.log("[YANDEX_ACTION_RES]", JSON.stringify(responsePayload, null, 2));
    res.json(responsePayload);

  } catch (err: any) {
    console.error("Yandex action failure:", err);
    res.status(401).json({ request_id: requestId, error: "invalid_token" });
  }
});

export default router;

