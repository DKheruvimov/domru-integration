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

  const addStreamLog = (msg: string) => {
    setStreamLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

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

  // Direct kernel stream resolution
  useEffect(() => {
    let isMounted = true;

    async function loadKernelActiveCallStream() {
      try {
        setLoadingStream(true);
        addStreamLog(`🔑 Авторизация: ${effCreds ? "найдена (" + (effCreds.operatorId || "OK") + ")" : "отсутствует"}`);
        addStreamLog("🛰️ Отправка запроса к /api/domru/call-stream-active...");

        const queryCam = cameraId ? `?cameraId=${cameraId}` : "";
        const res = await fetch(`/api/domru/call-stream-active${queryCam}`, { headers: proxyHeaders });
        
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
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber500/20 text-amber-400 border border-amber-500/30">
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
              selectedPlaceId={resolvedPlaceId || placeId || selectedPlace?.id}
              openingDoorId={opening ? deviceId : null}
              triggerOpenDoor={() => handleOpenDoor()}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-zinc-500 p-6 text-center max-w-md w-full">
            <ShieldAlert className="w-12 h-12 text-rose-500 mb-1 animate-pulse" />
            <span className="text-sm font-bold text-zinc-300">Загрузка трансляции с ядра...</span>
            
            {/* Live Client Diagnostic Log Box */}
            <div className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 text-left font-mono text-[11px] text-zinc-300 max-h-48 overflow-y-auto space-y-1.5 shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 border-b border-zinc-800 pb-1 mb-1">
                🛠️ Диагностика подключения:
              </div>
              {streamLogs.length > 0 ? (
                streamLogs.map((log, idx) => (
                  <div key={idx} className="leading-tight break-all">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-zinc-500 italic">Инициализация веб-клиента...</div>
              )}
            </div>
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
