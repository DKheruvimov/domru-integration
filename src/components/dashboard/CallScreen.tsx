import { useState, useEffect, useRef, useCallback } from "react";
import { SmartPlace, AppCredentials, SmartDevice, SmartCamera } from "../../types";

import CctvPlayer from "./CctvPlayer";
import { X, Lock, Unlock, Volume2, ShieldAlert, CheckCircle2 } from "lucide-react";

interface CallScreenProps {
  placeId: number;
  deviceId: number;
  cameraId: number;
  isTest?: boolean;
  credentials?: AppCredentials;
  useWebRTC?: boolean;
  isDevModeEnabled?: boolean;
  onClose: () => void;
  selectedPlace?: SmartPlace | null;
}

export default function CallScreen({
  placeId,
  deviceId,
  cameraId,
  isTest = false,
  credentials,
  useWebRTC = false,
  isDevModeEnabled = false,
  onClose,
  selectedPlace,
}: CallScreenProps) {
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDevLogs, setShowDevLogs] = useState(false);
  const [latestEvent, setLatestEvent] = useState<any | null>(null);
  const fetchedRef = useRef(false);


  // Active stream details resolved directly from kernel endpoint
  const [activeCameraId, setActiveCameraId] = useState<string>(
    cameraId && cameraId > 0 ? String(cameraId) : ""
  );
  const [resolvedPlaceId, setResolvedPlaceId] = useState<number>(placeId || selectedPlace?.id || 0);

  const [cameras, setCameras] = useState<SmartCamera[]>([]);
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [playerMode, setPlayerMode] = useState<"stream" | "snapshot">("stream");
  const [hasStreamError, setHasStreamError] = useState(false);
  const [forceHlsJS, setForceHlsJS] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [snapshotTime] = useState<number>(Date.now());

  const addStreamLog = useCallback((msg: string) => {
    setStreamLogs((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].includes(msg)) return prev;
      return [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
    });
  }, []);


  // Helper to retrieve saved credentials from localStorage if prop is pending
  const getEffectiveCredentials = (): AppCredentials | null => {
    if (credentials) return credentials;
    try {
      const saved = localStorage.getItem("domru_credentials");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  };

  const effCreds = getEffectiveCredentials();
  const proxyHeaders: Record<string, string> = effCreds
    ? { Authorization: `Bearer ${btoa(encodeURIComponent(JSON.stringify(effCreds)))}` }
    : {};

  const [modalImage, setModalImage] = useState<string | null>(null);

  // Helper to render event opening badge dynamically matching EventsView
  const renderOpeningBadge = (opening: any) => {
    if (!opening) {
      return (
        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-zinc-800 text-zinc-400 border border-zinc-700">
          ВХОДЯЩИЙ
        </span>
      );
    }
    const type = opening.type || "";
    if (type.includes("auto") || type.includes("schedule") || type.includes("people")) {
      return (
        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5">
          🚗 АВТО
        </span>
      );
    }
    if (type.includes("alice")) {
      return (
        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-0.5">
          🤖 ALICE
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
        ⚡ ВРУЧНУЮ
      </span>
    );
  };


  // Direct kernel stream resolution (runs strictly once)
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let isMounted = true;

    async function loadKernelActiveCallStream() {
      try {
        setLoadingStream(true);
        addStreamLog(`🔑 Авторизация: ${effCreds ? "найдена (" + (effCreds.operatorId || "OK") + ")" : "отсутствует"}`);
        addStreamLog("🛰️ Отправка запроса к /api/domru/call-stream-active...");

        const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const queryCam = cameraId ? `?cameraId=${cameraId}` : "";
        const queryTS = searchParams.get("timestamp") ? `${queryCam ? "&" : "?"}timestamp=${searchParams.get("timestamp")}` : "";
        const queryEvt = searchParams.get("eventId") ? `${queryCam || queryTS ? "&" : "?"}eventId=${searchParams.get("eventId")}` : "";
        const fullQuery = `${queryCam}${queryTS}${queryEvt}`;

        const res = await fetch(`/api/domru/call-stream-active${fullQuery}`, { headers: proxyHeaders });

        
        addStreamLog(`📡 Ответ сервера: HTTP ${res.status} ${res.statusText}`);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(`Ошибка ядра: HTTP ${res.status} (${errData.error || "Bad Request"})`);
        }

        const data = await res.json();
        addStreamLog(`📦 Данные: camera=${data.cameraId}, type=${data.type}`);

        if (data && data.url && isMounted) {
          setStreamUrl(data.url);
          setStreamType(data.type || "hls");
          setActiveCameraId(data.cameraId);
          if (data.placeId) setResolvedPlaceId(data.placeId);
          if (data.latestEvent) setLatestEvent(data.latestEvent);
          setHasStreamError(false);


          // Construct fallback camera object for CctvPlayer
          const mockCam: SmartCamera = {
            id: data.cameraId,
            name: "Камера вызова домофона",
            placeId: data.placeId || 0,
            allowVideo: true,
          };
          setCameras([mockCam]);

          addStreamLog(`✅ Поток получен напрямую от ядра! Camera: ${data.cameraId}`);
        } else {
          throw new Error("Сервер не вернул активный поток");
        }
      } catch (err: any) {
        console.error("[CallScreen] Kernel active stream error:", err);
        if (isMounted) {
          addStreamLog(`⛔ Сбой получения потока вызова: ${err.message}`);
          setHasStreamError(true);
        }
      } finally {
        if (isMounted) setLoadingStream(false);
      }
    }

    loadKernelActiveCallStream();
    return () => {
      isMounted = false;
    };
  }, [cameraId, credentials]);

  // Open door handler
  const handleOpenDoor = async () => {
    if (opening || opened) return;
    setOpening(true);
    setError(null);

    if (isTest) {
      setTimeout(() => {
        setOpening(false);
        setOpened(true);
        setTimeout(() => {
          setOpened(false);
        }, 4000);
      }, 1000);
      return;
    }

    try {
      const targetDeviceId = deviceId || (devices.length > 0 ? devices[0].id : 0);
      const res = await fetch("/api/domru/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...proxyHeaders,
        },
        body: JSON.stringify({
          placeId: placeId || resolvedPlaceId || selectedPlace?.id || 0,
          deviceId: targetDeviceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Не удалось открыть дверь");
      }

      setOpened(true);
      setTimeout(() => {
        setOpened(false);
      }, 5000);
    } catch (e: any) {
      setError(e.message || "Ошибка соединения при открытии");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F12] text-white flex flex-col justify-between overflow-hidden select-none animate-fade-in">
      {/* Top Header Bar Overlay */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 sm:p-5 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-900/40 animate-pulse">
            <Volume2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-white">
                {isTest ? "🧪 Тестовый звонок" : "🔔 Звонок в домофон"}
              </h2>
              {isTest && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  TEST
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-semibold truncate max-w-[220px] sm:max-w-xs">
              {selectedPlace?.visibleAddress || "Входная дверь подъезда"}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer backdrop-blur-md"
          title="Закрыть экран звонка"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Full-Width Video Stream Container (Borderless like Yandex) */}
      <div className="relative flex-1 w-full bg-black flex flex-col items-center justify-start overflow-y-auto pt-16 pb-32">
        {activeCameraId && credentials ? (
          <div className="w-full flex flex-col items-center">
            {/* Seamless Borderless Video Box */}
            <div className="w-full bg-black border-y border-zinc-800/50">
              <CctvPlayer
                activeCamera={activeCameraId}
                devices={devices}
                cameras={cameras}
                credentials={credentials}
                snapshotTime={snapshotTime}
                playerMode={playerMode}
                setPlayerMode={setPlayerMode}
                hasStreamError={hasStreamError}
                setHasStreamError={setHasStreamError}
                forceHlsJS={forceHlsJS}
                setForceHlsJS={setForceHlsJS}
                streamUrl={streamUrl}
                streamType={streamType}
                loadingStream={loadingStream}
                streamLogs={streamLogs}
                setStreamLogs={setStreamLogs}
                addStreamLog={addStreamLog}
                onClose={onClose}
                selectedPlaceId={resolvedPlaceId || placeId || selectedPlace?.id}
                openingDoorId={opening ? deviceId : null}
                triggerOpenDoor={() => handleOpenDoor()}
                isDevModeEnabled={isDevModeEnabled}
                isCallScreen={true}
              />
            </div>

            {/* Contextual Event Card matching 'События' tab */}
            {latestEvent && (
              <div className="w-full max-w-lg px-4 mt-4">
                <div className="bg-[#151B20]/90 border border-zinc-800/80 rounded-3xl p-3.5 flex items-center gap-3.5 shadow-2xl backdrop-blur-md">
                  {latestEvent.sipSnapshotUrl ? (
                    <button
                      onClick={() => setModalImage(latestEvent.sipSnapshotUrl)}
                      className="relative w-20 h-14 rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95 transition-transform group"
                      title="Нажмите для полноэкранного просмотра снимка"
                    >
                      <img
                        src={latestEvent.sipSnapshotUrl}
                        alt="Снимок вызова"
                        className="w-full h-full object-cover group-hover:brightness-110"
                      />
                      <span className="absolute top-1 left-1 px-1 py-0.2 rounded text-[8px] font-black bg-rose-600 text-white uppercase tracking-wider shadow">
                        SIP
                      </span>
                    </button>
                  ) : (
                    <div className="w-20 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center flex-shrink-0 text-zinc-400 text-[10px] font-bold">
                      БЕЗ СНИМКА
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <h4 className="text-sm font-black text-white truncate">
                          {latestEvent.name || "Вызов принят"}
                        </h4>
                        {renderOpeningBadge(latestEvent.openedByOurService)}
                      </div>
                      <span className="text-xs font-bold text-zinc-400 font-mono">
                        {new Date(latestEvent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 font-semibold mt-0.5 truncate">
                      {latestEvent.openedByOurService
                        ? `Наш сервис: ${latestEvent.openedByOurService.details || "Открыто пользователем"}`
                        : "Вызов через домофонную сеть"}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5 truncate">
                      {latestEvent.deviceName || "ДОМОФОН ПОДЪЕЗДА"}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-zinc-500 p-6 text-center w-full">
            <ShieldAlert className="w-12 h-12 text-rose-500 mb-1 animate-pulse" />
            <span className="text-sm font-bold text-zinc-300">Загрузка трансляции с ядра...</span>
          </div>
        )}



        {/* Success Overlay Flash */}
        {opened && (
          <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-md z-30 flex flex-col items-center justify-center animate-fade-in p-6">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black text-white">Дверь открыта!</h3>
            <p className="text-sm text-emerald-200 mt-1 font-semibold">Замок домофона отперт</p>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col items-center gap-3 pointer-events-auto">
        {error && (
          <div className="px-4 py-2 rounded-xl bg-rose-950/90 border border-rose-700/50 text-rose-300 text-xs font-bold animate-shake">
            ⚠️ {error}
          </div>
        )}

        <div className="w-full max-w-sm flex items-center justify-center gap-4">
          <button
            onClick={handleOpenDoor}
            disabled={opening}
            className={`w-full py-4 sm:py-5 px-6 rounded-3xl font-black text-lg sm:text-xl flex items-center justify-center gap-3 shadow-2xl transition-all transform active:scale-95 cursor-pointer ${
              opened
                ? "bg-emerald-600 text-white shadow-emerald-900/50"
                : opening
                ? "bg-rose-700/80 text-rose-200 cursor-wait"
                : "bg-gradient-to-r from-[#e30613] to-rose-600 hover:from-rose-600 hover:to-[#e30613] text-white shadow-rose-900/60 hover:shadow-rose-600/40"
            }`}
          >
            {opening ? (
              <>
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                <span>Открываем...</span>
              </>
            ) : opened ? (
              <>
                <Unlock className="w-6 h-6 text-white" />
                <span>ОТКРЫТО</span>
              </>
            ) : (
              <>
                <Lock className="w-6 h-6 text-white" />
                <span>ОТКРЫТЬ ДВЕРЬ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Fullscreen Snapshot Zoom Modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-fade-in pointer-events-auto"
          onClick={() => setModalImage(null)}
        >
          <button
            onClick={() => setModalImage(null)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white flex items-center justify-center border border-zinc-700/50 cursor-pointer shadow-2xl z-10"
            title="Закрыть фото"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="relative max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center overflow-hidden rounded-3xl border border-zinc-800/80 shadow-2xl">
            <img
              src={modalImage}
              alt="Снимок гостя крупным планом"
              className="max-w-full max-h-full object-contain rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <p className="text-xs text-zinc-400 font-semibold mt-4">
            Нажмите в любом месте, чтобы закрыть
          </p>
        </div>
      )}
    </div>
  );
}

