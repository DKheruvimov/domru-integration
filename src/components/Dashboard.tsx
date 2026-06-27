import { useState, useEffect, useCallback } from "react";
import { AppCredentials, SmartPlace, SmartDevice, SmartCamera, HistoryEvent, GuestPin } from "../types";
import MobileDashboard from "./dashboard/MobileDashboard";
import DesktopDashboard from "./dashboard/DesktopDashboard";

interface DashboardProps {
  credentials: AppCredentials;
  onLogout: () => void;
  isCabinetOpen: boolean;
  setIsCabinetOpen: (open: boolean) => void;
  isDevModeEnabled: boolean;
  setIsDevModeEnabled: (enabled: boolean) => void;
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  timezone: string;
  setTimezone: (tz: string) => void;
}

export default function Dashboard({ 
  credentials, 
  onLogout, 
  isCabinetOpen, 
  setIsCabinetOpen, 
  isDevModeEnabled,
  setIsDevModeEnabled,
  theme,
  setTheme,
  timezone,
  setTimezone
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"myhome" | "events" | "people" | "cabinet">("myhome");
  const [places, setPlaces] = useState<SmartPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SmartPlace | null>(null);
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [rawCameras, setRawCameras] = useState<any[]>([]);
  const [showAllCameras] = useState(false);

  // Compute cameras list dynamically
  const cameras: SmartCamera[] = (rawCameras || [])
    .filter((c: any) => {
      if (showAllCameras || credentials.isDemo) return true;
      if (!c.placeId) return true;
      return String(c.placeId) === String(selectedPlace?.id);
    })
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      placeId: c.placeId || selectedPlace?.id || 0,
      allowVideo: c.allowVideo !== false,
    }));

  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [pins, setPins] = useState<GuestPin[]>([]);

  // Stream state
  const [activeCamera, setActiveCamera] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [playerMode, setPlayerMode] = useState<"stream" | "snapshot">("stream");
  const [snapshotTime, setSnapshotTime] = useState(Date.now());
  const [hasStreamError, setHasStreamError] = useState(false);
  const [forceHlsJS, setForceHlsJS] = useState(false);

  const addStreamLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setStreamLogs((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // Snapshot auto-updated timer (every 1.5 seconds)
  useEffect(() => {
    if (!activeCamera || playerMode !== "snapshot") return;
    const interval = setInterval(() => {
      setSnapshotTime(Date.now());
    }, 1500);
    return () => clearInterval(interval);
  }, [activeCamera, playerMode]);

  // Close camera stream when switching tabs
  useEffect(() => {
    if (activeTab !== "myhome" && activeCamera) {
      setActiveCamera(null);
      setStreamUrl(null);
    }
  }, [activeTab, activeCamera]);

  // Door opening status
  const [openingDoorId, setOpeningDoorId] = useState<number | null>(null);
  const [doorMessage, setDoorMessage] = useState<string | null>(null);

  // Global triggers
  const [, setLoading] = useState(false);
  const [error, setError] = useState("");

  const proxyHeaders = {
    "x-domru-login": credentials.login || "",
    "x-domru-password": credentials.password || "",
    "x-domru-token": credentials.token || "",
    "x-domru-operator-id": credentials.operatorId ? String(credentials.operatorId) : "",
    "x-domru-refresh-token": credentials.refreshToken || "",
    "x-domru-demo": credentials.isDemo ? "true" : "false",
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch Places
      const placesRes = await fetch("/api/domru/places", { headers: proxyHeaders });
      if (!placesRes.ok) throw new Error("Не удалось загрузить объекты абонента");
      const placesRaw = await placesRes.json();

      const parsedPlaces: SmartPlace[] = placesRaw.map((p: any) => ({
        id: p.place?.id || p.id,
        visibleAddress: p.place?.address?.visibleAddress || "Адрес не указан",
        subscriberName: p.subscriber?.name || "Абонент",
        accountId: p.subscriber?.accountId || "—",
        balance: p.payment?.balance ?? 0.0,
        paymentPeriod: p.payment?.paymentPeriod || "до конца месяца",
      }));

      setPlaces(parsedPlaces);
      if (parsedPlaces.length > 0) {
        setSelectedPlace(parsedPlaces[0]);
      }
    } catch (err: any) {
      setError(err.message || "Ошибка при получении данных с сервера");
    } finally {
      setLoading(false);
    }
  };

  // Run initial fetch
  useEffect(() => {
    loadData();
  }, []);

  // Fetch devices and extra details once place changes
  useEffect(() => {
    if (!selectedPlace) return;

    const fetchPlaceDetails = async () => {
      setError("");
      let realDeviceIds: number[] = [];
      let loadedDevices: any[] = [];

      // 1. Load Devices
      try {
        const devRes = await fetch(`/api/domru/devices/${selectedPlace.id}`, { headers: proxyHeaders });
        if (devRes.ok) {
          const devRaw = await devRes.json();
          realDeviceIds = devRaw.map((d: any) => d.id);
          loadedDevices = devRaw;
          setDevices(
            devRaw.map((d: any) => ({
              id: d.id,
              name: d.name,
              type: d.type,
              allowOpen: d.allowOpen,
              allowVideo: d.allowVideo,
              externalCameraId: d.externalCameraId || "",
            }))
          );
        } else {
          setDevices([]);
        }
      } catch (err: any) {
        console.error("Ошибка при получении устройств:", err);
        setDevices([]);
      }

      // 2. Load Cameras
      try {
        const camRes = await fetch("/api/domru/cameras", { headers: proxyHeaders });
        if (camRes.ok) {
          const camRaw = await camRes.json();
          setRawCameras(camRaw);
        } else {
          setRawCameras([]);
        }
      } catch (err: any) {
        console.error("Ошибка при получении камер:", err);
        setRawCameras([]);
      }

      // 3. Load Pin codes (only if we have real device IDs)
      try {
        if (realDeviceIds.length > 0) {
          const pinRes = await fetch("/api/domru/temporal", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...proxyHeaders },
            body: JSON.stringify({ deviceIds: realDeviceIds }),
          });
          if (pinRes.ok) {
            const pinsRaw = await pinRes.json();
            setPins(
              pinsRaw.map((p: any) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                expiresAt: p.expiresAt || p.expires || "через пару часов",
              }))
            );
          } else {
            setPins([]);
          }
        } else {
          setPins([]);
        }
      } catch (err: any) {
        console.error("Ошибка при получении временных кодов:", err);
        setPins([]);
      }

      // 4. Load Events
      try {
        const eventsRes = await fetch("/api/domru/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...proxyHeaders },
          body: JSON.stringify({ placeIds: [selectedPlace.id] }),
        });
        if (eventsRes.ok) {
          const eventsRaw: any[] = await eventsRes.json();
          const parseSafeDate = (raw: any): string => {
            if (!raw) return new Date().toISOString();
            if (typeof raw === "number") {
              const d = new Date(raw < 100000000000 ? raw * 1000 : raw);
              return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
            }
            if (typeof raw === "string") {
              if (/^\d+$/.test(raw)) {
                const num = parseInt(raw, 10);
                const d = new Date(num < 100000000000 ? num * 1000 : num);
                return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
              }
              let cleaned = raw.trim();
              if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(cleaned)) {
                cleaned = cleaned.replace(" ", "T");
              }
              const d = new Date(cleaned);
              if (!isNaN(d.getTime())) {
                return d.toISOString();
              }
            }
            return new Date().toISOString();
          };

          const parsedEvents: HistoryEvent[] = eventsRaw.map((e: any, index: number) => {
            if (e.title !== undefined) {
              return {
                ...e,
                id: e.id || (Date.now() + index),
              };
            }

            const titleMap: Record<string, string> = {
              "DOOR_OPENED": "Дверь открыта",
              "VISITOR_CALL": "Входящий вызов",
              "GATE_OPENED": "Калитка открыта",
              "BARRIER_OPENED": "Шлагбаум открыт",
              "PLAY_STREAM": "Просмотр видео",
              "accessControlCallIncoming": "Входящий вызов",
              "accessControlCallAccepted": "Вызов принят",
              "accessControlCallDeclined": "Вызов отклонен",
              "accessControlCallMissed": "Пропущенный вызов",
              "accessControlCallNoAnswer": "Вызов без ответа",
              "accessControlCallEnded": "Разговор завершен",
              "accessControlDoorOpened": "Дверь открыта",
              "accessControlDoorOpen": "Дверь открыта",
              "accessControlOpen": "Дверь открыта",
              "accessControlCallCallback": "Обратный вызов",
              "accessControlCallTimeout": "Таймаут вызова",
              "accessControlCallOffline": "Офлайн вызов",
              "accessControlCallBuzzer": "Звонок в квартиру",
            };

            let title = titleMap[e.eventTypeName] || e.eventTypeName || "Событие домофона";
            if (!titleMap[e.eventTypeName] && e.eventTypeName) {
              const name = e.eventTypeName.toLowerCase();
              if (name.includes("dooropened") || name.includes("dooropen") || name.includes("door_opened")) {
                title = "Дверь открыта";
              } else if (name.includes("callincoming") || name.includes("visitor_call") || name.includes("visitorcall")) {
                title = "Входящий вызов";
              } else if (name.includes("callaccepted")) {
                title = "Вызов принят";
              } else if (name.includes("calldeclined")) {
                title = "Вызов отклонен";
              } else if (name.includes("callmissed") || name.includes("noanswer") || name.includes("no_answer")) {
                title = "Пропущенный вызов";
              } else if (name.includes("callended")) {
                title = "Разговор завершен";
              } else if (name.includes("playstream") || name.includes("play_stream")) {
                title = "Просмотр видео";
              }
            }

            const imageUrl =
              e.value?.images?.p_640x480 ||
              e.value?.images?.raw ||
              e.value?.images?.p_144x96 ||
              undefined;

            let description = e.message;
            if (!description || description === "Вызов или проход на территорию") {
              const name = (e.eventTypeName || "").toLowerCase();
              if (name.includes("callaccepted")) {
                description = "Вызов принят из приложения или с трубки";
              } else if (name.includes("calldeclined")) {
                description = "Вызов отклонен пользователем";
              } else if (name.includes("callincoming")) {
                description = "Входящий звонок на домофон";
              } else if (name.includes("callmissed") || name.includes("noanswer")) {
                description = "Звонок остался без ответа";
              } else if (name.includes("dooropened") || name.includes("dooropen")) {
                description = "Дверь успешно открыта";
              } else {
                description = "Событие на точке прохода";
              }
            }

            const matchedDevice = loadedDevices.find((d: any) => Number(d.id) === Number(e.source?.id));
            const deviceName = matchedDevice?.name || e.source?.name || "Входной домофон";

            return {
              id: Number(e.id) || (Date.now() + index),
              timestamp: parseSafeDate(e.occurredAt || e.timestamp),
              eventType: e.eventTypeName || "INFO",
              title,
              description,
              deviceName,
              imageUrl,
              sipSnapshotUrl: e.sipSnapshotUrl || undefined,
              openedByOurService: e.openedByOurService || undefined,
            };
          });
          setEvents(parsedEvents);
        } else {
          setEvents([]);
        }
      } catch (err: any) {
        console.error("Ошибка при получении истории событий:", err);
        setEvents([]);
      }
    };

    fetchPlaceDetails();
  }, [selectedPlace]);

  // Load stream once camera selected
  useEffect(() => {
    if (!activeCamera) {
      setStreamUrl(null);
      setStreamType(null);
      setHasStreamError(false);
      return;
    }

    setPlayerMode("stream");
    setHasStreamError(false);

    const fetchStream = async () => {
      try {
        setLoadingStream(true);
        setStreamLogs([]);
        addStreamLog(`Запрос URL потока для камеры ${activeCamera} с сервера...`);

        const res = await fetch(`/api/domru/stream-go2rtc/${activeCamera}`, { headers: proxyHeaders });
        if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status} ${res.statusText}`);
        const data = await res.json();

        if (!data || !data.webrtcUrl) {
          throw new Error("Сервер вернул некорректный ответ (возможно, ошибка go2rtc).");
        }

        addStreamLog(`[go2rtc] Камера зарегистрирована! WebRTC URL: ${data.webrtcUrl}`);
        setStreamUrl(data.webrtcUrl);
        setStreamType("go2rtc");
      } catch (err: any) {
        console.error(err);
        addStreamLog(`⛔ Сбой получения потока: ${err.message}`);
        setStreamUrl(null);
        setStreamType(null);
        setHasStreamError(true);
      } finally {
        setLoadingStream(false);
      }
    };

    fetchStream();
  }, [activeCamera]);

  // Handle open door command
  const triggerOpenDoor = async (deviceId: number) => {
    if (!selectedPlace) return;
    setOpeningDoorId(deviceId);
    setDoorMessage(null);

    try {
      const res = await fetch("/api/domru/open", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...proxyHeaders },
        body: JSON.stringify({
          placeId: selectedPlace.id,
          deviceId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось открыть дверь");

      setDoorMessage("🔓 Доступ разрешен! Дверь открыта на 5 секунд.");

      const opDevice = devices.find((d) => d.id === deviceId);
      const newEvent: HistoryEvent = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        eventType: "DOOR_OPENED",
        title: "Дверь открыта",
        description: `Жилец открыл дверь "${opDevice?.name || "Входной домофон"}" с мобильного контроллера`,
        deviceName: opDevice?.name || "Дверь",
      };
      setEvents((prev) => [newEvent, ...prev]);
    } catch (err: any) {
      setDoorMessage(`❌ Ошибка открытия: ${err.message}`);
    } finally {
      setTimeout(() => {
        setOpeningDoorId(null);
        setDoorMessage(null);
      }, 6000);
    }
  };

  // Generate Guest Code
  const makeGuestPin = async () => {
    const names = ["Доставка Яндекс", "Клининг", "Сантехник", "Доставка Ozon", "Друзья"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomCode = String(Math.floor(1000 + Math.random() * 9000));

    const newPin: GuestPin = {
      id: Date.now(),
      code: randomCode,
      name: randomName,
      expiresAt: "через 4 часа",
    };

    setPins((prev) => [newPin, ...prev]);

    const extraEvent: HistoryEvent = {
      id: Date.now() + 1,
      timestamp: new Date().toISOString(),
      eventType: "PIN_CREATED",
      title: "Создан гостевой код",
      description: `Сгенерирован код доступа "${randomCode}" для: ${randomName}`,
      deviceName: "Мобильный клиент",
    };
    setEvents((prev) => [extraEvent, ...prev]);
  };

  // Helper to format ISO date to readable Russian day
  const formatDateGroup = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Сегодня";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Вчера";
    } else {
      return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
    }
  };

  // Group events by date
  const groupedEvents: Record<string, HistoryEvent[]> = {};
  events.forEach((evt) => {
    const groupKey = formatDateGroup(evt.timestamp);
    if (!groupedEvents[groupKey]) {
      groupedEvents[groupKey] = [];
    }
    groupedEvents[groupKey].push(evt);
  });

  // Responsive Layout detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize(); // initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sharedProps = {
    activeTab,
    setActiveTab,
    places,
    selectedPlace,
    setSelectedPlace,
    devices,
    cameras,
    credentials,
    snapshotTime,
    playerMode,
    setPlayerMode,
    hasStreamError,
    setHasStreamError,
    forceHlsJS,
    setForceHlsJS,
    streamUrl,
    streamType,
    loadingStream,
    streamLogs,
    setStreamLogs,
    addStreamLog,
    activeCamera,
    setActiveCamera,
    setStreamUrl,
    openingDoorId,
    triggerOpenDoor,
    doorMessage,
    pins,
    makeGuestPin,
    groupedEvents,
    onLogout,
    loadData,
    isCabinetOpen,
    setIsCabinetOpen,
    isDevModeEnabled,
    setIsDevModeEnabled,
    theme,
    setTheme,
    timezone,
    setTimezone,
    proxyHeaders,
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400 rounded-2xl animate-fade-in">
          {error}
        </div>
      )}

      {isMobile ? (
        <MobileDashboard {...sharedProps} />
      ) : (
        <DesktopDashboard {...sharedProps} />
      )}
    </div>
  );
}
