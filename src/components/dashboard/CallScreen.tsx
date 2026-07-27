import { useState, useEffect } from "react";
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
  onClose,
  selectedPlace,
}: CallScreenProps) {
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stream & Player state matching CctvPlayer
  const [activeCameraId, setActiveCameraId] = useState<string>(
    cameraId && cameraId > 0 ? String(cameraId) : ""
  );
  const [cameras, setCameras] = useState<SmartCamera[]>([]);
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [playerMode, setPlayerMode] = useState<"stream" | "snapshot">("stream");
  const [hasStreamError, setHasStreamError] = useState(false);
  const [forceHlsJS, setForceHlsJS] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [snapshotTime] = useState<number>(Date.now());

  const addStreamLog = (msg: string) => {
    setStreamLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const proxyHeaders: Record<string, string> = credentials
    ? { Authorization: `Bearer ${btoa(encodeURIComponent(JSON.stringify(credentials)))}` }
    : {};

  // 1. Fetch cameras & devices for this placeId if not provided
  useEffect(() => {
    let isMounted = true;

    async function loadPlaceDetails() {
      if (!credentials) return;

      try {
        // 1. Always fetch account cameras first
        const camRes = await fetch(`/api/domru/cameras`, { headers: proxyHeaders });
        if (camRes.ok && isMounted) {
          const camRaw: SmartCamera[] = await camRes.json();
          setCameras(camRaw);

          const currentValid = activeCameraId && activeCameraId !== "0" && activeCameraId !== "undefined";
          if (!currentValid && camRaw.length > 0) {
            setActiveCameraId(String(camRaw[0].id));
          }
        }

        // 2. Resolve placeId if missing
        let targetPlaceId = placeId || selectedPlace?.id || 0;
        if (!targetPlaceId) {
          const placesRes = await fetch("/api/domru/places/all", { headers: proxyHeaders });
          if (placesRes.ok) {
            const placesRaw = await placesRes.json();
            if (placesRaw && placesRaw.length > 0) {
              const p = placesRaw[0];
              targetPlaceId = p.place?.id || p.id || p.placeId || 0;
            }
          }
        }

        // 3. Fetch devices for place if available
        if (targetPlaceId) {
          const devRes = await fetch(`/api/domru/devices/${targetPlaceId}`, { headers: proxyHeaders });
          if (devRes.ok && isMounted) {
            const devRaw = await devRes.json();
            setDevices(devRaw);
          }
        }


      } catch (e) {
        console.error("[CallScreen] Error loading cameras/devices:", e);
      }
    }

    loadPlaceDetails();
    return () => {
      isMounted = false;
    };
  }, [placeId, credentials, selectedPlace]);


  // 2. Load stream when activeCameraId or credentials change
  useEffect(() => {
    if (!activeCameraId || activeCameraId === "0" || !credentials) {
      setStreamUrl(null);
      setStreamType(null);
      return;
    }

    setPlayerMode("stream");
    setHasStreamError(false);

    const fetchStream = async () => {
      try {
        setLoadingStream(true);
        setStreamLogs([]);
        addStreamLog(`Запрос URL потока для камеры ${activeCameraId}...`);

        if (useWebRTC) {
          addStreamLog(`⚠️ Используется WebRTC (режим без задержек)`);
          const res = await fetch(`/api/domru/stream-go2rtc/${activeCameraId}`, { headers: proxyHeaders });
          if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status} ${res.statusText}`);
          const data = await res.json();
          if (!data || !data.webrtcUrl) throw new Error("Сервер не вернул WebRTC URL.");
          addStreamLog(`[WebRTC] Камера зарегистрирована в go2rtc.`);
          setStreamUrl(data.webrtcUrl);
          setStreamType("go2rtc");
        } else {
          const res = await fetch(`/api/domru/stream/${activeCameraId}`, { headers: proxyHeaders });
          if (!res.ok) throw new Error(`Ошибка HTTP: ${res.status} ${res.statusText}`);
          const data = await res.json();
          if (!data || !data.url) throw new Error("Сервер не вернул URL потока.");
          addStreamLog(`[HLS] Камера зарегистрирована! URL: ${data.url}`);
          setStreamUrl(data.url);
          setStreamType("hls");
        }
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
  }, [activeCameraId, useWebRTC, credentials]);


  // 3. Open door handler
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
          placeId: placeId || selectedPlace?.id || 0,
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
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none animate-fade-in">
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-600/90 flex items-center justify-center shadow-lg shadow-rose-900/50 animate-pulse">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
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
          className="w-10 h-10 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer backdrop-blur-md"
          title="Закрыть экран звонка"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main CctvPlayer Video Section */}
      <div className="relative flex-1 w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
        {activeCameraId && credentials ? (
          <div className="w-full h-full flex items-center justify-center">
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
              selectedPlaceId={placeId || selectedPlace?.id}
              openingDoorId={opening ? deviceId : null}
              triggerOpenDoor={() => handleOpenDoor()}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-500 p-6 text-center">
            <ShieldAlert className="w-12 h-12 text-zinc-600 mb-2" />
            <span className="text-sm font-bold text-zinc-300">Подключение трансляции...</span>
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
    </div>
  );
}
