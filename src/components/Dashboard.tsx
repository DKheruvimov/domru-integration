import { useState, useEffect, useRef } from "react";
import { AppCredentials, SmartPlace, SmartDevice, SmartCamera, HistoryEvent, GuestPin } from "../types";
import {
  Home,
  CreditCard,
  Lock,
  Unlock,
  Video,
  VideoOff,
  User,
  History,
  KeyRound,
  RefreshCw,
  LogOut,
  Sliders,
  Bell,
  CheckCircle,
  Clock,
  ExternalLink,
  Terminal,
  ChevronRight,
  ShieldCheck,
  Users,
  Plus,
  Car,
  MessageSquare,
} from "lucide-react";

interface DashboardProps {
  credentials: AppCredentials;
  onLogout: () => void;
}

export default function Dashboard({ credentials, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"myhome" | "events" | "people" | "cabinet">("myhome");
  const [places, setPlaces] = useState<SmartPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SmartPlace | null>(null);
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [rawCameras, setRawCameras] = useState<any[]>([]);
  const [showAllCameras, setShowAllCameras] = useState(false);

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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const addStreamLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setStreamLogs((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 50));
  };

  // Snapshot auto-updated timer (every 1.5 seconds)
  useEffect(() => {
    if (!activeCamera || playerMode !== "snapshot") return;
    const interval = setInterval(() => {
      setSnapshotTime(Date.now());
    }, 1500);
    return () => clearInterval(interval);
  }, [activeCamera, playerMode]);

  // Door opening status
  const [openingDoorId, setOpeningDoorId] = useState<number | null>(null);
  const [doorMessage, setDoorMessage] = useState<string | null>(null);

  // Global triggers
  const [loading, setLoading] = useState(false);
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

      // 1. Load Devices
      try {
        const devRes = await fetch(`/api/domru/devices/${selectedPlace.id}`, { headers: proxyHeaders });
        if (devRes.ok) {
          const devRaw = await devRes.json();
          realDeviceIds = devRaw.map((d: any) => d.id);
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
          const parsedEvents: HistoryEvent[] = eventsRaw.map((e: any, index: number) => {
            if (e.title !== undefined) {
              return {
                ...e,
                id: e.id || (Date.now() + index)
              };
            }

            const titleMap: Record<string, string> = {
              "DOOR_OPENED": "Дверь открыта",
              "VISITOR_CALL": "Входящий вызов",
              "GATE_OPENED": "Калитка открыта",
              "BARRIER_OPENED": "Шлагбаум открыт",
              "PLAY_STREAM": "Просмотр видео",
            };

            const title = titleMap[e.eventTypeName] || e.eventTypeName || "Событие домофона";
            const imageUrl = e.value?.images?.p_640x480 || e.value?.images?.raw || e.value?.images?.p_144x96 || undefined;

            return {
              id: Number(e.id) || (Date.now() + index),
              timestamp: e.timestamp || new Date().toISOString(),
              eventType: e.eventTypeName || "INFO",
              title,
              description: e.message || "Вызов или проход на территорию",
              deviceName: e.source?.name || "Входной домофон",
              imageUrl,
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

        const res = await fetch(`/api/domru/stream/${activeCamera}`, { headers: proxyHeaders });
        if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status} ${res.statusText}`);
        const data = await res.json();

        if (!data || !data.url) {
          throw new Error("Сервер вернул пустой URL потока (возможно, камера офлайн).");
        }

        addStreamLog(`Получен ответ: тип=${data.type || 'unknown'}, URL=${data.url}`);
        setStreamUrl(data.url);
        setStreamType(data.type || 'unknown');
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

  // HLS/FLV stream player handler using Ref
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl || !streamType) return;

    addStreamLog("--- ИНИЦИАЛИЗАЦИИ ВИДЕОПОТОКА ---");
    
    if (streamType === "mjpeg") {
      addStreamLog("MJPEG-поток инициализирован.");
      return;
    }
    
    const nativeHlsSupported = video.canPlayType("application/vnd.apple.mpegurl") !== "";
    const handlePlaying = () => addStreamLog("▶ HTML5 Video: Воспроизведение успешно началось!");
    const handleVideoError = () => {
      const err = video.error;
      addStreamLog(`⛔ Ошибка HTML5 Video: Код ${err ? err.code : "неизвестно"}`);
      setHasStreamError(true);
    };

    video.addEventListener("playing", handlePlaying);
    video.addEventListener("error", handleVideoError);

    let hlsInstance: any = null;
    let mpegtsPlayer: any = null;

    const isHls = streamType === "hls" || streamUrl.includes(".m3u8");
    const isFlv = streamType === "flv" || streamUrl.includes(".flv");

    if (isFlv) {
      const loadMpegts = async () => {
        if (!(window as any).mpegts) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Не удалось загрузить mpegts.js"));
            document.head.appendChild(script);
          });
        }
        const mpegts = (window as any).mpegts;
        if (mpegts && mpegts.isSupported()) {
          mpegtsPlayer = mpegts.createPlayer({ type: 'flv', isLive: true, url: streamUrl, cors: true });
          mpegtsPlayer.attachMediaElement(video);
          mpegtsPlayer.load();
          mpegtsPlayer.play().catch((e: any) => console.log("Auto-start blocked", e));
        } else {
          video.src = streamUrl;
        }
      };
      loadMpegts().catch((e) => console.error(e));
    } else if (isHls) {
      if (nativeHlsSupported && !forceHlsJS) {
        video.src = streamUrl;
      } else {
        const loadHls = async () => {
          if (!(window as any).Hls) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Не удалось загрузить Hls.js"));
              document.head.appendChild(script);
            });
          }
          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported()) {
            hlsInstance = new Hls({ lowLatencyMode: true, maxBufferLength: 10 });
            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);
          } else {
            video.src = streamUrl;
          }
        };
        loadHls().catch((e) => console.error(e));
      }
    } else {
      video.src = streamUrl;
    }

    return () => {
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("error", handleVideoError);
      if (hlsInstance) hlsInstance.destroy();
      if (mpegtsPlayer) mpegtsPlayer.destroy();
    };
  }, [streamUrl, streamType, forceHlsJS]);

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

  return (
    <div className="space-y-6" id="dashboard_panel">
      {/* Top Address & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-850 p-2.5 rounded-full text-zinc-400">
            <Car className="w-5 h-5" />
          </div>
          
          <div className="relative flex items-center bg-zinc-850 border border-zinc-800/80 rounded-full px-4 py-2 hover:bg-zinc-800 transition">
            <select
              value={selectedPlace?.id || ""}
              onChange={(e) => {
                const f = places.find((p) => p.id === Number(e.target.value));
                if (f) setSelectedPlace(f);
              }}
              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-6 appearance-none border-none py-0.5 leading-tight font-sans"
              style={{ colorScheme: "dark" }}
              id="place_select_dropdown"
            >
              {places.map((p, idx) => (
                <option key={`${p.id}-${p.accountId || idx}-${idx}`} value={p.id} className="bg-zinc-900 text-white font-semibold">
                  {p.visibleAddress}
                </option>
              ))}
            </select>
            <div className="absolute right-4 pointer-events-none text-[8px] text-zinc-455 font-black">
              ▼
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {credentials.isDemo && (
            <span className="px-3 py-1.5 text-[10px] bg-[#E30613]/10 text-[#E30613] font-bold rounded-full border border-[#E30613]/25 mr-2">
              Режим симуляции (Demo)
            </span>
          )}
          <button
            onClick={loadData}
            className="p-2.5 bg-zinc-850 border border-zinc-800 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition shadow-2xs"
            title="Обновить данные"
            id="global_refresh_btn"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400 rounded-2xl animate-fade-in">
          {error}
        </div>
      )}

      {/* Navigation tabs matching the mobile screens */}
      <div className="grid grid-cols-4 gap-1 bg-zinc-900 border border-zinc-800/80 p-1 rounded-2xl shadow-lg max-w-xl mx-auto">
        <button
          onClick={() => setActiveTab("myhome")}
          className={`py-3 text-[11px] font-extrabold rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === "myhome"
              ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/20"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Мой дом</span>
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`py-3 text-[11px] font-extrabold rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === "events"
              ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/20"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>События</span>
        </button>
        <button
          onClick={() => setActiveTab("people")}
          className={`py-3 text-[11px] font-extrabold rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === "people"
              ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/20"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Люди</span>
        </button>
        <button
          onClick={() => setActiveTab("cabinet")}
          className={`py-3 text-[11px] font-extrabold rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === "cabinet"
              ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/20"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Кабинет</span>
        </button>
      </div>

      {/* CCTV player widget displayed if camera is actively viewing */}
      {activeCamera && (() => {
        const matchingDevice = devices.find((d) => d.externalCameraId === activeCamera || String(d.id) === activeCamera);
        
        const buildSnapshotUrl = (placeId: number | string | undefined, deviceId: number | string) => {
          if (!placeId) return "";
          const params = new URLSearchParams();
          params.set("t", String(snapshotTime));
          if (credentials.isDemo) {
            params.set("demo", "true");
          } else {
            if (credentials.login) params.set("login", credentials.login);
            if (credentials.password) params.set("password", credentials.password);
            if (credentials.token) params.set("token", credentials.token);
            if (credentials.operatorId) params.set("operatorId", String(credentials.operatorId));
            if (credentials.refreshToken) params.set("refreshToken", credentials.refreshToken);
          }
          return `/api/domru/snapshot/${placeId}/${deviceId}?${params.toString()}`;
        };

        return (
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-[2rem] shadow-xl flex flex-col space-y-4 animate-fade-in max-w-3xl mx-auto" id="cctv_visualizer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-[#E30613] animate-pulse" />
                <span className="font-extrabold text-sm text-white">
                  {cameras.find((c) => c.id === activeCamera)?.name || matchingDevice?.name || "Просмотр видеопотока"}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveCamera(null);
                  setStreamUrl(null);
                }}
                className="px-3.5 py-1.5 bg-[#E30613]/10 text-[#E30613] font-bold rounded-xl hover:bg-[#E30613]/20 transition text-xs"
                id="close_cctv_btn"
              >
                <VideoOff className="w-3.5 h-3.5 inline mr-1" />
                Закрыть
              </button>
            </div>

            {matchingDevice && (
              <div className="flex items-center justify-between bg-zinc-850 p-1.5 rounded-2xl border border-zinc-800 text-xs">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPlayerMode("stream")}
                    className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
                      playerMode === "stream"
                        ? "bg-zinc-900 text-white shadow-xs border border-zinc-800"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    📡 Поток (HLS)
                  </button>
                  <button
                    onClick={() => setPlayerMode("snapshot")}
                    className={`px-3.5 py-1.5 rounded-xl font-bold transition ${
                      playerMode === "snapshot"
                        ? "bg-zinc-900 text-white shadow-xs border border-zinc-800"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    📸 Снимки
                  </button>
                </div>
                <div className="text-[10px] text-zinc-450 mr-2 hidden sm:block font-bold">
                  {playerMode === "stream" ? "Рекомендуется H.264" : `Обновление ~1.5с • ${new Date(snapshotTime).toLocaleTimeString()}`}
                </div>
              </div>
            )}

            <div className="aspect-video w-full bg-zinc-955 rounded-2xl overflow-hidden relative flex items-center justify-center border border-zinc-850">
              {playerMode === "snapshot" && matchingDevice ? (
                <div className="w-full h-full relative">
                  <img
                    key={snapshotTime}
                    src={buildSnapshotUrl(selectedPlace?.id, matchingDevice.id)}
                    alt="Кадр с домофона"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={() => {
                      addStreamLog("⛔ Сбой загрузки снимка с домофона.");
                    }}
                  />
                  <div className="absolute top-3 left-3 bg-black/75 px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider flex items-center gap-1.5 text-white">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    РЕЖИМ СНАПШОТОВ (1.5С)
                  </div>
                </div>
              ) : loadingStream ? (
                <div className="text-xs text-zinc-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
                  <span>Подключение к IP-потоку Dom.ru…</span>
                </div>
              ) : streamUrl ? (
                streamUrl.toLowerCase().startsWith("rtsp://") ? (
                  <div className="text-xs text-zinc-400 p-8 text-center max-w-md flex flex-col items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 text-amber-550 rounded-xl">
                      <VideoOff className="w-6 h-6" />
                    </div>
                    <p className="font-extrabold text-white text-sm">Протокол RTSP не поддерживается браузерами напрямую</p>
                    <p className="text-[11px] text-zinc-405 leading-relaxed font-sans">
                      Экраны домофонов Dom.ru выдают сырой RTSP-адрес. Скопируйте ссылку ниже и запустите в плеере (например, VLC).
                    </p>
                  </div>
                ) : streamType === "mjpeg" ? (
                  <img
                    src={streamUrl}
                    alt="MJPEG Stream"
                    className="w-full h-full object-cover"
                    onError={() => {
                      addStreamLog("⛔ Сбой загрузки MJPEG-потока.");
                    }}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    controls
                    autoPlay
                    playsInline
                    loop
                    muted
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="text-xs text-zinc-550 p-8 text-center">
                  <p className="font-semibold text-zinc-400">Поток временно недоступен</p>
                </div>
              )}
            </div>

            {hasStreamError && playerMode === "stream" && matchingDevice && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3.5 rounded-2xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                <div>
                  <p className="font-bold">⚠️ Проблемы с воспроизведением видео-потока</p>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
                    Ваш браузер или соединение не могут принять HLS-видео. Рекомендуем переключиться на режим снимков.
                  </p>
                </div>
                <button
                  onClick={() => setPlayerMode("snapshot")}
                  className="shrink-0 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-3 py-1.5 rounded-lg transition"
                >
                  На снапшоты
                </button>
              </div>
            )}

            {streamUrl && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2.5 text-[10px] text-zinc-400 font-mono border-b border-zinc-800 pb-2">
                  <span>Состояние: Подключено</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setForceHlsJS(!forceHlsJS)}
                      className="hover:text-[#E30613] bg-zinc-850 px-2.5 py-1.5 rounded-lg font-sans font-bold transition border border-zinc-800"
                    >
                      🔧 {forceHlsJS ? "Авто-плеер" : "Hls.js"}
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(streamUrl);
                        addStreamLog("📋 Ссылка скопирована!");
                      }}
                      className="hover:text-[#E30613] bg-zinc-850 px-2.5 py-1.5 rounded-lg transition border border-zinc-800"
                    >
                      Скопировать URL
                    </button>
                  </div>
                </div>

                <details className="group mt-3 border border-zinc-800 rounded-2xl bg-zinc-900/10 overflow-hidden animate-fade-in">
                  <summary className="px-4 py-2.5 text-[10px] font-bold tracking-wider text-zinc-500 hover:text-zinc-200 cursor-pointer flex items-center justify-between font-sans select-none list-none">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-[#E30613]" />
                      Техническая диагностика потока (Dev-логи)
                    </span>
                    <span className="text-[9px] bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-450 font-mono">
                      {streamLogs.length} событий
                    </span>
                  </summary>
                  <div className="p-4 border-t border-zinc-800 bg-zinc-950 font-mono text-[11px] leading-relaxed select-text shadow-inner">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2 text-zinc-550">
                      <span>Журнал событий плеера</span>
                      <button onClick={() => setStreamLogs([])} className="text-[9px] text-[#E30613] font-bold">Очистить</button>
                    </div>
                    <div className="bg-black/30 border border-zinc-850 rounded-xl p-3 h-48 overflow-y-auto space-y-1 text-zinc-400 font-mono text-[10px]" id="video_logs_scroller">
                      {streamLogs.length > 0 ? (
                        streamLogs.map((log, index) => (
                          <div key={index} className="whitespace-pre-wrap">{log}</div>
                        ))
                      ) : (
                        <div className="text-center text-zinc-600 mt-16">Логи пусты</div>
                      )}
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        );
      })()}

      {/* Main Tab Views */}
      <div className="max-w-4xl mx-auto">
        {/* VIEW 1: MY HOME (Dashboard Grid) */}
        {activeTab === "myhome" && (
          <div className="space-y-6">
            
            {/* Announcements Banners matching the mobile style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/20 to-[#E30613]/10 border border-indigo-900/30 p-5 rounded-3xl relative overflow-hidden flex justify-between items-center group shadow-md">
                <div className="space-y-2 z-10 max-w-[68%]">
                  <h3 className="font-extrabold text-white text-base tracking-tight leading-tight">
                    Подключайте тариф ПРО
                  </h3>
                  <p className="text-xs text-zinc-400 leading-normal">
                    Предложение специально для вас: неограниченный видеоархив и расширенный доступ.
                  </p>
                  <button className="mt-2.5 px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-white rounded-full text-xs font-bold transition shadow-xs">
                    Подключить
                  </button>
                </div>
                <div className="text-5xl select-none transform group-hover:rotate-6 transition duration-300 z-10 pr-2">
                  📦
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-3xl flex justify-between items-center group shadow-md">
                <div className="space-y-2 z-10 max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
                    <h3 className="font-extrabold text-white text-sm tracking-tight leading-tight">
                      Подтвердите ваши ключи
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-normal">
                    Подтвердите достоверность ключей для корректной работы сервисов безопасности.
                  </p>
                  <button className="mt-2 px-4 py-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded-full text-xs font-bold transition shadow-xs">
                    Подтвердить
                  </button>
                </div>
                <div className="text-4xl opacity-30 group-hover:opacity-50 transition duration-300 pr-2 select-none">
                  🛡️
                </div>
              </div>
            </div>

            {/* Smart Access Devices sections */}
            <div className="bg-zinc-900 border border-zinc-805 p-6 rounded-[2rem] shadow-md">
              <h2 className="text-base font-extrabold text-white mb-6 font-display uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-[#E30613] rounded-full inline-block" />
                Доступы и домофоны
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {devices.length > 0 ? (
                  devices.map((device, idx) => {
                    const isOpening = openingDoorId === device.id;
                    return (
                      <div
                        key={device.id || idx}
                        className={`relative aspect-[4/3] rounded-3xl overflow-hidden flex flex-col justify-between p-4 group transition-all duration-300 border ${
                          isOpening
                            ? "border-emerald-500 ring-2 ring-emerald-500/25 scale-98 bg-zinc-950"
                            : "border-zinc-800 bg-zinc-850 hover:bg-zinc-800 hover:scale-[1.01] hover:shadow-lg"
                        }`}
                        id={`device_card_${device.id}`}
                      >
                        {/* Film/Video strip placeholder background */}
                        <div className="absolute inset-0 bg-zinc-900/70 flex items-center justify-center pointer-events-none group-hover:bg-zinc-900/60 transition">
                          <Video className="w-10 h-10 text-zinc-700 opacity-40 group-hover:opacity-70 group-hover:scale-105 transition duration-300" />
                        </div>

                        {/* Top bar (Address details) */}
                        <div className="relative z-10 bg-zinc-900/50 backdrop-blur-xs p-2 rounded-xl border border-white/5 inline-self-start max-w-[85%]">
                          <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block leading-none">
                            {device.type === "intercom" ? "Домофон" : "Калитка"}
                          </span>
                          <h3 className="font-extrabold text-xs text-white mt-1 truncate leading-none">
                            {device.name}
                          </h3>
                        </div>

                        {/* Bottom action controls */}
                        <div className="relative z-10 flex items-center justify-between w-full mt-auto pt-2">
                          {device.allowVideo && device.externalCameraId && (
                            <button
                              onClick={() => setActiveCamera(device.externalCameraId)}
                              className="px-3 py-1.5 bg-black/50 hover:bg-black/75 text-white text-[10px] font-bold rounded-full border border-white/5 transition flex items-center gap-1 leading-none shadow-sm"
                            >
                              <Video className="w-3.5 h-3.5 text-[#E30613]" />
                              Смотреть
                            </button>
                          )}

                          {device.allowOpen ? (
                            <button
                              onClick={() => triggerOpenDoor(device.id)}
                              disabled={openingDoorId !== null}
                              className={`p-3.5 rounded-full transition-all duration-300 ml-auto shadow-md ${
                                isOpening
                                  ? "bg-emerald-500 text-white cursor-default"
                                  : "bg-[#E30613] hover:bg-[#c20510] active:scale-90 text-white"
                              }`}
                              id={`open_btn_${device.id}`}
                            >
                              {isOpening ? (
                                <Unlock className="w-5 h-5 animate-pulse" />
                              ) : (
                                <Lock className="w-5 h-5" />
                              )}
                            </button>
                          ) : (
                            <div className="text-[10px] text-zinc-500 italic ml-auto bg-zinc-900/80 px-2.5 py-1 rounded-lg">
                              Заблокировано
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full text-center py-12 text-xs text-zinc-400">
                    Активные домофонные устройства не обнаружены
                  </div>
                )}
              </div>
            </div>
            
            {doorMessage && (
              <div className="p-4 bg-emerald-500/10 text-xs font-bold text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center gap-2 animate-fade-in max-w-md mx-auto">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{doorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: EVENTS (Grouped Log events) */}
        {activeTab === "events" && (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] shadow-md space-y-6 animate-fade-in">
            {/* Promo banner */}
            <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-2xl flex justify-between items-center group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <CheckCircle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-white">Увеличьте архив событий домофона</h4>
                  <p className="text-[10px] text-zinc-450 mt-0.5 leading-normal">История звонков и открытий дверей будет храниться до 14 дней.</p>
                </div>
              </div>
              <button className="text-xs text-indigo-400 font-extrabold hover:underline mr-2 shrink-0">Подробнее</button>
            </div>

            {/* Event Log Filter pills */}
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-[11px] font-extrabold text-zinc-350 hover:text-white rounded-full transition shadow-xs">Дата</button>
              <button className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-[11px] font-extrabold text-zinc-350 hover:text-white rounded-full transition shadow-xs">Устройства</button>
              <button className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-[11px] font-extrabold text-zinc-350 hover:text-white rounded-full transition shadow-xs">Люди</button>
            </div>

            {/* Date-grouped list */}
            <div className="space-y-6">
              {Object.keys(groupedEvents).length > 0 ? (
                Object.entries(groupedEvents).map(([dateLabel, dateEvts]) => (
                  <div key={dateLabel} className="space-y-3">
                    <h4 className="text-[11px] font-extrabold text-zinc-500 uppercase tracking-widest ml-1">
                      {dateLabel}
                    </h4>
                    <div className="space-y-2">
                      {dateEvts.map((event, idx) => (
                        <div
                          key={event.id || idx}
                          className="bg-zinc-850/50 border border-zinc-800/80 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800 transition"
                        >
                          <div className="flex items-center gap-3.5">
                            {event.imageUrl ? (
                              <div className="w-16 h-11 bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-zinc-800">
                                <img
                                  src={event.imageUrl}
                                  alt="Снимок вызова"
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-[#E30613] shrink-0 border border-zinc-800">
                                <Bell className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-bold text-white leading-snug">{event.title}</p>
                              <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{event.description}</p>
                              <span className="text-[9px] text-zinc-505 font-mono font-bold block mt-1">
                                Устройство: {event.deviceName}
                              </span>
                            </div>
                          </div>
                          
                          <span className="text-xs font-mono font-bold text-zinc-400 mr-1">
                            {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-xs text-zinc-450 font-semibold">История вызовов пуста</div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: PEOPLE (Guest PIN Codes) */}
        {activeTab === "people" && (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] shadow-md space-y-6 animate-fade-in">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-white font-display">Гостевые коды доступа</h2>
                <p className="text-xs text-zinc-455 mt-1">Временные PIN-коды для гостей, курьеров и сотрудников служб</p>
              </div>
              <button
                onClick={makeGuestPin}
                className="px-4 py-2 bg-[#E30613] hover:bg-[#c20510] text-white text-xs font-extrabold rounded-full transition shadow-md shadow-[#E30613]/10"
                id="generate_pin_btn"
              >
                + Создать код
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pins.length > 0 ? (
                pins.map((pin, idx) => (
                  <div key={pin.id || idx} className="p-4 bg-zinc-850 border border-zinc-800 rounded-2xl flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="text-xs font-extrabold text-white">{pin.name}</div>
                      <div className="text-[10px] text-zinc-450 mt-1 flex items-center gap-1 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Истекает: {pin.expiresAt}</span>
                      </div>
                    </div>
                    
                    <div className="px-3.5 py-1.5 bg-[#E30613]/10 border border-[#E30613]/25 text-[#E30613] font-mono font-black text-sm rounded-xl tracking-wider shadow-inner">
                      {pin.code}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-xs text-zinc-455 font-semibold">
                  Нет активных временных кодов доступа
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 4: CABINET (Finances & Service settings) */}
        {activeTab === "cabinet" && (
          <div className="space-y-6 animate-fade-in">
            {/* Account Info Badge */}
            <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-[2rem] shadow-md space-y-5">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block leading-none">
                  Договор {selectedPlace?.accountId || "—"}
                </span>
                <div className="flex items-center gap-2 mt-1.5 leading-none">
                  <h3 className="font-extrabold text-base text-white">Услуги активны</h3>
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Текущий баланс</span>
                  <span className="font-display font-black text-3xl text-white block mt-1.5 leading-none">
                    {selectedPlace ? selectedPlace.balance.toFixed(2) : "0.00"} <span className="text-xl font-semibold text-zinc-450">₽</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Порог списания</span>
                  <span className="text-xs font-bold text-zinc-300 block mt-3 leading-none">
                    {selectedPlace ? selectedPlace.paymentPeriod : "Нет счетов"}
                  </span>
                </div>
              </div>

              <button className="w-full mt-2 py-3 bg-[#E30613] hover:bg-[#c20510] active:scale-98 transition text-white rounded-xl text-xs font-bold shadow-md shadow-[#E30613]/15 flex items-center justify-center gap-2 uppercase tracking-wider">
                <CreditCard className="w-4 h-4" />
                Пополнить баланс
              </button>
            </div>

            {/* List options matching the screenshots */}
            <div className="bg-zinc-900 border border-zinc-805/85 rounded-[2rem] shadow-md overflow-hidden divide-y divide-zinc-800/80">
              <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-355 hover:text-white cursor-pointer hover:bg-zinc-800/25 transition">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-4.5 h-4.5 text-[#E30613]" />
                  <span>Мои ключи</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-550" />
              </div>
              <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-355 hover:text-white cursor-pointer hover:bg-zinc-800/25 transition">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-4.5 h-4.5 text-[#E30613]" />
                  <span>Помощь и поддержка</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-550" />
              </div>
              <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-355 hover:text-white cursor-pointer hover:bg-zinc-800/25 transition">
                <div className="flex items-center gap-3">
                  <Bell className="w-4.5 h-4.5 text-[#E30613]" />
                  <span>Уведомления</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-550" />
              </div>
              <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-355 hover:text-white cursor-pointer hover:bg-zinc-800/25 transition">
                <div className="flex items-center gap-3">
                  <Clock className="w-4.5 h-4.5 text-[#E30613]" />
                  <span>О приложении</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-550" />
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={onLogout}
              className="w-full py-3.5 border border-red-500/20 hover:border-red-500/40 text-xs font-bold text-red-400 rounded-2xl hover:bg-red-500/5 transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs font-sans uppercase tracking-wider"
              id="logout_btn"
            >
              <LogOut className="w-4 h-4" />
              Выйти из аккаунта
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
