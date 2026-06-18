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
} from "lucide-react";

interface DashboardProps {
  credentials: AppCredentials;
  onLogout: () => void;
}

export default function Dashboard({ credentials, onLogout }: DashboardProps) {
  const [places, setPlaces] = useState<SmartPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SmartPlace | null>(null);
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [rawCameras, setRawCameras] = useState<any[]>([]);
  const [showAllCameras, setShowAllCameras] = useState(false);

  // Compute cameras list dynamically based on raw list and showAllCameras / placeId matches
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
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [playerMode, setPlayerMode] = useState<"stream" | "snapshot">("stream");
  const [snapshotTime, setSnapshotTime] = useState(Date.now());
  const [hasStreamError, setHasStreamError] = useState(false);
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

      // Parse SmartPlace array using real physical place.id
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
          // Normalize events from both mock and real Domru API
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
      setHasStreamError(false);
      return;
    }

    setPlayerMode("stream");
    setHasStreamError(false);

    const fetchStream = async () => {
      try {
        setLoadingStream(true);
        setStreamLogs([]); // Clear logs for new stream request
        addStreamLog(`Запрос URL потока для камеры ${activeCamera} с сервера...`);

        const res = await fetch(`/api/domru/stream/${activeCamera}`, { headers: proxyHeaders });
        if (!res.ok) throw new Error(`Ошибка HTTP сервера: ${res.status} ${res.statusText}`);
        const data = await res.json();

        if (!data || !data.url) {
          throw new Error("Сервер вернул пустой URL потока (камера может быть офлайн).");
        }

        addStreamLog(`Получен ответ: тип=${data.type || 'unknown'}, URL=${data.url}`);
        setStreamUrl(data.url);
      } catch (err: any) {
        console.error(err);
        addStreamLog(`⛔ Сбой получения потока: ${err.message}`);
        setStreamUrl(null);
        setHasStreamError(true);
      } finally {
        setLoadingStream(false);
      }
    };

    fetchStream();
  }, [activeCamera]);

  // HLS stream handler using Ref and Hls.js with detailed logs and listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    addStreamLog("Подготовка плеера HTML5 <video>...");

    const handleLoadStart = () => addStreamLog("HTML5 Video: Запуск загрузки (loadstart)...");
    const handleLoadedMetadata = () => addStreamLog(`HTML5 Video: Мета-данные получены. Размер: ${video.videoWidth}x${video.videoHeight}px`);
    const handleLoadedData = () => addStreamLog("HTML5 Video: Первый кадр видеоданных загружен (loadeddata)");
    const handleCanPlay = () => addStreamLog("HTML5 Video: Поток готов к старту воспроизведения (canplay)");
    const handlePlaying = () => addStreamLog("▶ HTML5 Video: Воспроизведение успешно началось (playing)!");
    const handleWaiting = () => addStreamLog("HTML5 Video: Буферизация, ожидание следующего чанка (waiting)...");
    const handleStalled = () => addStreamLog("⚠ HTML5 Video: Канал прервался/подзавис (stalled). Ожидание кадров.");
    const handleEmptied = () => addStreamLog("HTML5 Video: Ресурс медиа очищен (emptied).");
    const handleVideoError = () => {
      const err = video.error;
      let errMsg = "Неизвестная ошибка медиа-элемента";
      if (err) {
        switch (err.code) {
          case 1: errMsg = "MEDIA_ERR_ABORTED (Получение прервано пользователем/браузером)"; break;
          case 2: errMsg = "MEDIA_ERR_NETWORK (Сетевая ошибка при скачивании сегмента)"; break;
          case 3: errMsg = "MEDIA_ERR_DECODE (Сбой декодирования/некорректный кодек видеопотока)"; break;
          case 4: errMsg = "MEDIA_ERR_SRC_NOT_SUPPORTED (Формат видео не поддерживается браузером или заблокирован CORS)"; break;
        }
      }
      addStreamLog(`⛔ Ошибка HTML5 Video (${err ? err.code : '?' }): ${errMsg}`);
      setHasStreamError(true);
    };

    video.addEventListener("loadstart", handleLoadStart);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("emptied", handleEmptied);
    video.addEventListener("error", handleVideoError);

    let hlsInstance: any = null;

    const isHls = streamUrl.includes(".m3u8") || 
                  streamUrl.includes("hls") || 
                  streamUrl.includes("manifest") || 
                  streamUrl.includes("playlist") ||
                  streamUrl.includes("stream-proxy") ||
                  (activeCamera && !streamUrl.includes("mjpeg"));

    if (isHls) {
      addStreamLog("Формат потока определен как HLS (M3U8) или совместимый. Проверяем возможность воспроизведения...");
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        addStreamLog("Найдена родная поддержка HLS (Safari/iOS Safari). Запуск напрямую.");
        video.src = streamUrl;
      } else {
        addStreamLog("Родной поддержки HLS нет. Загружаем отладчик-клиент Hls.js...");
        const loadHls = async () => {
          if (!(window as any).Hls) {
            addStreamLog("Запрос Hls.js библиотеки из глобального CDN...");
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Не удалось загрузить скрипт Hls.js с удаленного CDN"));
              document.head.appendChild(script);
            });
            addStreamLog("Библиотека Hls.js успешно загружена.");
          }

          const Hls = (window as any).Hls;
          if (Hls && Hls.isSupported()) {
            addStreamLog("Hls.js поддерживается этой версией браузера. Инициализация...");
            hlsInstance = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              maxBufferLength: 10,
              xhrSetup: (xhr: XMLHttpRequest, url: string) => {
                // Allows us to track if HTTP or HTTPS is used
                if (url.startsWith("http://") && window.location.protocol === "https:") {
                  addStreamLog("⚠ Опасно: Вы зашли через HTTPS, а чанк запрашивается по HTTP. Браузер может заблокировать как Mixed Content!");
                }
              }
            });

            hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
              addStreamLog("Hls.js: Видео-элемент подключен.");
            });

            hlsInstance.on(Hls.Events.MANIFEST_PARSED, (evt: any, data: any) => {
              addStreamLog(`Hls.js: Манифест потока распарсен! Найдено дорожек (levels): ${data?.levels?.length || 0}`);
              video.play().catch((e) => {
                addStreamLog(`⚠ Автовоспроизведение остановлено браузером (нужен клик пользователя): ${e.message}`);
              });
            });

            hlsInstance.on(Hls.Events.ERROR, (evt: any, data: any) => {
              const { category, details, fatal } = data;
              const lvl = fatal ? "🚨 КРИТИЧЕСКАЯ" : "предупреждение";
              addStreamLog(`Hls.js событие [${lvl}]:: ${category} - ${details}`);

              if (fatal) {
                setHasStreamError(true);
                if (category === Hls.ErrorTypes.NETWORK_ERROR) {
                  addStreamLog("🔄 Сетевая ошибка Hls.js (Возможный CORS или оффлайн-сервер). Перезапуск загрузки...");
                  hlsInstance.startLoad();
                } else if (category === Hls.ErrorTypes.MEDIA_ERROR) {
                  addStreamLog("🔄 Ошибка медиа контента Hls.js. Сброс позиции буфера...");
                  hlsInstance.recoverMediaError();
                } else {
                  addStreamLog("❌ Неисправимая ошибка воспроизведения Hls.js. Прерывание.");
                  hlsInstance.destroy();
                }
              }
            });

            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);
          } else {
            addStreamLog("⚠ Браузер не поддерживает Hls.js API. Пробуем прямой src.");
            video.src = streamUrl;
          }
        };

        loadHls().catch((e) => {
          addStreamLog(`⛔ Сбой при запуске Hls.js движка: ${e.message}`);
          video.src = streamUrl;
        });
      }
    } else {
      addStreamLog("Протокол не HLS (mjpeg, mp4 или rtsp). Пробуем запуск в стандартный src.");
      video.src = streamUrl;
    }

    return () => {
      // Cleanup
      video.removeEventListener("loadstart", handleLoadStart);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("emptied", handleEmptied);
      video.removeEventListener("error", handleVideoError);

      if (hlsInstance) {
        addStreamLog("Очистка и уничтожение Hls-плеера.");
        hlsInstance.destroy();
      }
    };
  }, [streamUrl]);

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

      // Append new event to logs
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
      // Keep state active for 6 seconds to simulate duration
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

    // Track in logs too
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

  return (
    <div className="space-y-6" id="dashboard_panel">
      {/* Top Banner / Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-805/65 p-6 rounded-[2rem] shadow-sm animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#E30613]/10 dark:bg-[#E30613]/15 text-[#E30613] rounded-2xl">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-zinc-950 dark:text-white leading-tight font-display">
                {selectedPlace ? selectedPlace.visibleAddress : "Локации не найдены"}
              </h1>
              {credentials.isDemo && (
                <span className="px-2.5 py-0.5 text-[10px] bg-[#E30613]/10 dark:bg-red-950/45 text-[#E30613] dark:text-red-400 font-bold rounded-full">
                  Демо-режим
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
              <User className="w-3.5 h-3.5" />
              <span>{selectedPlace ? selectedPlace.subscriberName : "Загрузка…"}</span>
              <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] rounded-lg font-mono text-zinc-650 dark:text-zinc-350">
                Договор: {selectedPlace?.accountId}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Places selector if multiple addresses */}
          {places.length > 1 && (
            <select
              value={selectedPlace?.id || ""}
              onChange={(e) => {
                const f = places.find((p) => p.id === Number(e.target.value));
                if (f) setSelectedPlace(f);
              }}
              className="text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-3 py-2 rounded-xl focus:outline-none focus:ring-0"
              id="place_select_dropdown"
            >
              {places.map((p, idx) => (
                <option key={`${p.id}-${p.accountId || idx}-${idx}`} value={p.id}>
                  {p.visibleAddress}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={loadData}
            className="p-2 border border-zinc-200 dark:border-zinc-850 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition shadow-2xs"
            title="Update Data"
            id="global_refresh_btn"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onLogout}
            className="px-4 py-2 border border-red-200 hover:border-red-350 dark:border-red-950 text-xs font-semibold text-red-650 dark:text-red-400 rounded-xl hover:bg-red-500/5 dark:hover:bg-red-500/10 transition flex items-center gap-1.5"
            id="logout_btn"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-sm text-red-650 dark:text-red-400 rounded-2xl">
          {error}
        </div>
      )}

      {/* Grid: Financials, Key Pins, Entrance Devices & Streams */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column (Finance + Guest Key codes) */}
        <div className="space-y-6 md:col-span-1">
          {/* Account Balance Widget */}
          <div className="bg-[#18181B] border border-zinc-800 dark:border-zinc-800/80 rounded-[2rem] p-6 shadow-lg relative overflow-hidden text-white" id="widget_finances">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#E30613]/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex items-center gap-2 text-zinc-400 mb-4">
              <CreditCard className="w-4 h-4 text-[#E30613]" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Баланс и Финансы</span>
            </div>
            {selectedPlace ? (
              <div>
                <div className="text-4xl font-extrabold font-display text-white tracking-tight">
                  {selectedPlace.balance.toFixed(2)} <span className="text-lg font-semibold text-zinc-400">₽</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mt-3">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Порог списания: </span>
                  <span className="font-semibold text-zinc-200">{selectedPlace.paymentPeriod}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-400 py-3">Анализ финансовых данных…</div>
            )}
            <button className="w-full mt-5 py-3 bg-[#E30613] hover:bg-[#c20510] active:scale-98 transition text-white rounded-xl text-xs font-bold shadow-md shadow-[#E30613]/20 font-sans">
              Пополнить счёт личного кабинета
            </button>
          </div>

          {/* Guest PIN Pass Codes */}
          <div className="bg-white dark:bg-[#18181B] border border-zinc-150 dark:border-zinc-805/70 rounded-[2rem] p-6 shadow-sm" id="widget_temporal_pins">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-zinc-400">
                <KeyRound className="w-4 h-4 text-[#E30613]" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Гостевые Коды (PIN)</span>
              </div>
              <button
                onClick={makeGuestPin}
                className="text-xs px-3 py-1.5 bg-[#E30613]/10 dark:bg-[#E30613]/15 text-[#E30613] dark:text-red-400 font-bold rounded-xl hover:bg-[#E30613]/25 dark:hover:bg-[#E30613]/25 transition font-sans"
                id="generate_pin_btn"
              >
                + Сгенерировать
              </button>
            </div>

            <div className="space-y-3">
              {pins.length > 0 ? (
                pins.map((pin, idx) => (
                  <div key={`${pin.id || 'pin'}-${idx}`} className="p-3.5 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800/50 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-200 font-sans">{pin.name}</div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-zinc-400" />
                        <span>Истекает: {pin.expiresAt}</span>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 bg-[#E30613]/10 border border-[#E30613]/20 text-[#E30613] dark:text-red-400 font-mono font-bold text-sm rounded-xl tracking-wider shadow-2xs">
                      {pin.code}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-zinc-400">Нет активных временных кодов доступа</div>
              )}
            </div>
          </div>
        </div>

        {/* Center/Right Columns (Doors controllers & Active video streams) */}
        <div className="space-y-6 md:col-span-2">
          {/* Smart Door Access controllers */}
          <div className="bg-white dark:bg-[#18181B] border border-zinc-150 dark:border-zinc-805/70 p-6 rounded-[2rem] shadow-xs" id="widget_intercoms">
            <div className="flex items-center gap-2 text-zinc-400 mb-4">
              <Sliders className="w-4 h-4 text-[#E30613]" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Устройства контроля доступа</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {devices.length > 0 ? (
                devices.map((device, idx) => {
                  const isOpening = openingDoorId === device.id;
                  return (
                    <div
                      key={`${device.id || 'device'}-${idx}`}
                      className={`border p-4.5 rounded-2xl flex flex-col justify-between h-40 transition-all ${
                        isOpening
                          ? "border-[#E30613] bg-[#E30613]/5 dark:bg-[#E30613]/10 shadow-sm"
                          : "border-zinc-100 dark:border-zinc-800/65 bg-zinc-50/20 dark:bg-zinc-900/20 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                      }`}
                      id={`device_card_${device.id}`}
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <span className="text-[10px] font-bold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
                            {device.type === "intercom" ? "Домофон" : device.type === "gate" ? "Калитка" : "Преграда"}
                          </span>
                          {device.allowVideo && device.externalCameraId && (
                            <button
                              onClick={() => setActiveCamera(device.externalCameraId)}
                              className={`p-1.5 rounded-xl text-xs flex items-center gap-1 transition ${
                                activeCamera === device.externalCameraId
                                  ? "text-[#E30613] dark:text-red-400 font-bold bg-[#E30613]/10 dark:bg-[#E30613]/20"
                                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              }`}
                              title="Посмотреть камеру"
                              id={`device_cam_btn_${device.id}`}
                            >
                              <Video className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mt-1 truncate">
                          {device.name}
                        </h3>
                      </div>

                      {device.allowOpen ? (
                        <button
                          onClick={() => triggerOpenDoor(device.id)}
                          disabled={openingDoorId !== null}
                          className={`w-full py-2 rounded-xl text-xs font-bold tracking-tight transition duration-150 flex items-center justify-center gap-2 ${
                            isOpening
                              ? "bg-emerald-500 text-white cursor-default"
                              : "bg-[#E30613] hover:bg-[#c20510] text-white disabled:opacity-50"
                          }`}
                          id={`open_btn_${device.id}`}
                        >
                          {isOpening ? (
                            <>
                              <Unlock className="w-3.5 h-3.5 animate-bounce" />
                              <span>Открыто…</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Открыть дверь</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="text-[11px] text-zinc-400 italic text-center py-2">
                          Открытие отключено провайдером
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 text-center py-12 text-xs text-zinc-400">Калитки или домофоны не обнаружены.</div>
              )}
            </div>

            {doorMessage && (
              <div className="mt-4 p-3 bg-emerald-500/5 dark:bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/20 rounded-xl flex items-center gap-2 animate-fade-in shadow-2xs">
                <CheckCircle className="w-4 h-4 text-emerald-550 shrink-0" />
                <span>{doorMessage}</span>
              </div>
            )}
          </div>

          {/* Active Cam Player Visualizer */}
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
              <div className="bg-white dark:bg-[#18181B] text-zinc-900 dark:text-white border border-zinc-150 dark:border-zinc-805/70 p-6 rounded-[2rem] shadow-sm flex flex-col space-y-4 animate-fade-in" id="cctv_visualizer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-sans">
                    <Video className="w-4 h-4 text-[#E30613] animate-pulse" />
                    <span className="font-bold text-sm font-display">
                      {cameras.find((c) => c.id === activeCamera)?.name || 
                       matchingDevice?.name || 
                       "Просмотр потока камеры"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveCamera(null);
                      setStreamUrl(null);
                    }}
                    className="px-3 py-1.5 bg-[#E30613]/10 dark:bg-[#E30613]/15 text-[#E30613] dark:text-red-400 font-bold rounded-xl hover:bg-[#E30613]/25 dark:hover:bg-[#E30613]/25 transition text-xs font-sans"
                    id="close_cctv_btn"
                  >
                    <VideoOff className="w-3.5 h-3.5 inline mr-1" />
                    Закрыть трансляцию
                  </button>
                </div>

                {/* Mode Toggles */}
                {matchingDevice && (
                  <div className="flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30 p-1.5 rounded-2xl border border-zinc-100 dark:border-zinc-805/65 text-xs font-sans">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setPlayerMode("stream");
                          addStreamLog("📺 Переключение на режим видео-потока...");
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold transition ${
                          playerMode === "stream"
                            ? "bg-white dark:bg-[#18181B] text-[#E30613] dark:text-white shadow-xs border border-zinc-150 dark:border-zinc-805/60"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-[#E30613] dark:hover:text-red-400"
                        }`}
                      >
                        📡 Видео-поток (HLS)
                      </button>
                      <button
                        onClick={() => {
                          setPlayerMode("snapshot");
                          addStreamLog("📸 Переключение на покадровый режим снапшотов...");
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold transition ${
                          playerMode === "snapshot"
                            ? "bg-white dark:bg-[#18181B] text-[#E30613] dark:text-white shadow-xs border border-zinc-150 dark:border-zinc-805/60"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-[#E30613] dark:hover:text-red-400"
                        }`}
                      >
                        📸 Снапшоты (Покадрово)
                      </button>
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mr-2 hidden sm:block font-medium">
                      {playerMode === "stream" ? "Рекомендуется H.264/AAC" : `Обновление ~1.5с • ${new Date(snapshotTime).toLocaleTimeString()}`}
                    </div>
                  </div>
                )}

                <div className="aspect-video w-full max-w-3xl mx-auto bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden relative flex items-center justify-center border border-zinc-200 dark:border-zinc-850">
                  {playerMode === "snapshot" && matchingDevice ? (
                    <div className="w-full h-full relative group">
                      <img
                        key={snapshotTime} // Force image element remount/refresh
                        src={buildSnapshotUrl(selectedPlace?.id, matchingDevice.id)}
                        alt="Кадр с домофона"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          addStreamLog("⛔ Сбой загрузки снимка с домофона. Возможно, устройство временно не в сети.");
                        }}
                      />
                      <div className="absolute top-3 left-3 bg-black/75 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider flex items-center gap-1.5 text-white">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        РЕЖИМ СНАПШОТОВ (1.5С)
                      </div>
                    </div>
                  ) : loadingStream ? (
                    <div className="text-xs text-zinc-500 flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-teal-500" />
                      <span>Подключение к IP-потоку Dom.ru…</span>
                    </div>
                  ) : streamUrl ? (
                    streamUrl.toLowerCase().startsWith("rtsp://") ? (
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 p-8 text-center max-w-md flex flex-col items-center gap-3">
                        <div className="p-2.5 bg-amber-550/10 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-xl">
                          <VideoOff className="w-6 h-6" />
                        </div>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm">Протокол RTSP не поддерживается браузерами напрямую</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans">
                          Экраны домофонов Dom.ru иногда выдают сырой RTSP-адрес. Веб-браузеры не умеют декодировать RTSP без медиасервера-нарезчика. Скопируйте ссылку ниже и откройте в плеере (например, VLC).
                        </p>
                      </div>
                    ) : (
                      /* Render dynamic live player using videoRef with Hls.js support */
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
                    <div className="text-xs text-zinc-500 p-8 text-center">
                      <p className="font-semibold text-zinc-600 dark:text-zinc-400">Поток недоступен (неподдерживаемый формат RTSP/HLS на этом клиенте)</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-2 font-mono">
                        Stream url: {streamUrl || "отсутствует"}
                      </p>
                    </div>
                  )}
                </div>

                {hasStreamError && playerMode === "stream" && matchingDevice && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 p-3.5 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
                    <div className="space-y-0.5">
                      <p className="font-semibold flex items-center gap-1.5">
                        <span>⚠️ Проблемы с воспроизведением видео-потока</span>
                      </p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal">
                        Ваш браузер или VPN-соединение не могут принять HLS-видео. Рекомендуем переключиться на 100% стабильный покадровый режим для экономии трафика.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setPlayerMode("snapshot");
                        addStreamLog("🔁 Авто-переключение на покадровый режим по кнопке действия.");
                      }}
                      className="shrink-0 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold px-3 py-1.5 rounded-lg transition"
                    >
                      Перейти на снапшоты
                    </button>
                  </div>
                )}
              {streamUrl && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono border-b border-zinc-200 dark:border-zinc-800 pb-2">
                    <span>Состояние: Соединение установлено</span>
                    <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(streamUrl);
                          addStreamLog("📋 Ссылка на поток скопирована в буфер обмена!");
                        }}
                        className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1 transition-colors bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg"
                      >
                        <span>Скопировать URL</span>
                      </button>
                      <a
                        href={streamUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <span>Открыть в новой вкладке</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Real-time Diagnostics Terminal Console */}
                  <div className="border border-zinc-150 dark:border-zinc-805/85 bg-zinc-50/50 dark:bg-[#111113] rounded-[1.5rem] p-4 font-mono text-[11px] leading-relaxed select-text shadow-inner animate-fade-in">
                    <div className="flex items-center justify-between border-b border-zinc-110 dark:border-zinc-800/60 pb-2 mb-2 text-zinc-500 dark:text-zinc-400 font-sans">
                      <div className="flex items-center gap-2 font-sans font-bold uppercase text-[9px] tracking-wider text-[#E30613] dark:text-red-400">
                        <Terminal className="w-3.5 h-3.5 animate-pulse" />
                        <span>Консоль Диагностики и Отладки Потока Dom.ru</span>
                      </div>
                      <button
                        onClick={() => setStreamLogs([])}
                        className="text-[9px] text-zinc-600 dark:text-zinc-400 hover:text-white bg-white dark:bg-zinc-900 hover:bg-[#E30613] border border-zinc-200 dark:border-zinc-800 px-2.5 py-0.5 rounded transition"
                      >
                        Очистить консоль
                      </button>
                    </div>

                    <div className="text-zinc-550 mb-2 truncate text-[10px]">
                      <span className="text-zinc-400 font-bold font-sans">URL источника:</span>{" "}
                      <code className="text-zinc-600 dark:text-zinc-350 break-all select-all hover:bg-zinc-101 dark:hover:bg-zinc-900 p-0.5 rounded transition">{streamUrl}</code>
                    </div>

                    <div className="bg-white dark:bg-black/30 border border-zinc-150 dark:border-zinc-850 rounded-xl p-3 h-48 overflow-y-auto space-y-1.5 text-zinc-700 dark:text-zinc-350" id="video_logs_scroller">
                      {streamLogs.length > 0 ? (
                        streamLogs.map((log, index) => {
                          let colorClass = "text-zinc-505 dark:text-zinc-400 font-mono";
                          if (log.includes("⛔") || log.includes("🚨")) {
                            colorClass = "text-rose-600 dark:text-rose-300 font-semibold bg-rose-500/5 px-1 rounded border-l-2 border-rose-500";
                          } else if (log.includes("⚠️") || log.includes("⚠")) {
                            colorClass = "text-amber-600 dark:text-amber-400 bg-amber-500/5 px-1 rounded border-l-2 border-amber-500 font-semibold";
                          } else if (log.includes("▶") || log.includes("успешно") || log.includes("готов")) {
                            colorClass = "text-emerald-500 dark:text-emerald-450 font-semibold bg-emerald-500/5 px-1 rounded border-l-2 border-emerald-500";
                          } else if (log.includes("Hls.js") || log.includes("HTML5")) {
                            colorClass = "text-[#E30613]/85 dark:text-red-350";
                          }
                          return (
                            <div key={index} className={`${colorClass} whitespace-pre-wrap text-[10px]`}>
                              {log}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center text-zinc-400 dark:text-zinc-650 mt-16 text-[10px] font-sans font-medium">Консоль отладки пуста. Ожидаются события видеоплеера...</div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-150 dark:border-zinc-800/60 font-sans">
                      <div className="flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Зелёный: Успешный запуск
                      </div>
                      <div className="flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        Красный: Сбой или Блокировка
                      </div>
                      <div className="flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Жёлтый: Буферизация / Mixed-Content
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

          {/* Historical Logs & Call Alarm triggers */}
          <div className="bg-white dark:bg-[#18181B] border border-zinc-150 dark:border-zinc-805/70 p-6 rounded-[2rem] shadow-sm animate-fade-in" id="widget_events">
            <div className="flex items-center gap-2 text-zinc-455 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <History className="w-4 h-4 text-[#E30613]" />
              <span className="text-xs font-bold uppercase tracking-wider font-sans">История событий (Логи домофона)</span>
            </div>

            <div className="space-y-4">
              {events.length > 0 ? (
                events.map((event, idx) => (
                  <div key={`${event.id || 'event'}-${idx}`} className="flex gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/30 rounded-2xl transition">
                    {event.imageUrl ? (
                      <div className="w-24 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 font-sans">
                        <img
                          src={event.imageUrl}
                          alt="Событие"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center shrink-0 border border-dashed border-zinc-250 dark:border-zinc-805">
                        <Bell className="w-5 h-5 text-zinc-450 animate-pulse" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 font-sans">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#E30613] dark:text-red-400 uppercase tracking-tight">
                          {event.title}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono font-medium">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-705 dark:text-zinc-300 leading-normal mb-1 font-medium select-text">
                        {event.description}
                      </p>
                      <span className="inline-block text-[10px] text-zinc-400 font-mono font-medium">
                        Устройство: {event.deviceName}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-zinc-400 font-sans font-medium">Архив вызовов и открытий пуст</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
