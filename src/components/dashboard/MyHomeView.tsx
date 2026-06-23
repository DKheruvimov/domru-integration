import { useState, useEffect } from "react";
import { SmartDevice, AppCredentials } from "../../types";
import { Video, CheckCircle, Lock, Unlock, PhoneForwarded, PhoneOff } from "lucide-react";
import AutoOpenConfigModal from "./AutoOpenConfigModal";

interface MyHomeViewProps {
  devices: SmartDevice[];
  setActiveCamera: (cameraId: string) => void;
  doorMessage: string | null;
  selectedPlaceId?: number;
  credentials?: AppCredentials;
  isCompactMode?: boolean;
  openingDoorId?: number | null;
  triggerOpenDoor?: (deviceId: number) => void;
}

export default function MyHomeView({
  devices,
  setActiveCamera,
  doorMessage,
  selectedPlaceId,
  credentials,
  isCompactMode = false,
  openingDoorId = null,
  triggerOpenDoor,
}: MyHomeViewProps) {
  const [localSnapshotTime, setLocalSnapshotTime] = useState(Date.now());

  useEffect(() => {
    setLocalSnapshotTime(Date.now());
  }, [devices]);

  const [autoOpenState, setAutoOpenState] = useState<Record<number, number | boolean>>({});
  const [isTogglingAutoOpen, setIsTogglingAutoOpen] = useState<Record<number, boolean>>({});
  const [configModalDeviceId, setConfigModalDeviceId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/domru/sip/auto-open/status")
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setAutoOpenState(data);
        }
      })
      .catch(err => console.error("Failed to fetch auto-open status", err));
  }, []);

  const toggleAutoOpen = async (deviceId: number, durationMinutes?: number, maxOpens?: number | null) => {
    if (isTogglingAutoOpen[deviceId]) return;
    setIsTogglingAutoOpen(prev => ({ ...prev, [deviceId]: true }));
    const newState = !autoOpenState[deviceId];
    try {
      const res = await fetch("/api/domru/sip/auto-open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-domru-token": credentials?.token || "",
          "x-domru-refresh-token": credentials?.refreshToken || "",
        },
        body: JSON.stringify({
          placeId: selectedPlaceId,
          deviceId: deviceId,
          enabled: newState,
          durationMinutes,
          maxOpens
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAutoOpenState(prev => ({ ...prev, [deviceId]: newState ? (data.expiresAt || true) : false }));
      } else {
        const errData = await res.json();
        alert(`Ошибка авто-открытия: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Сетевая ошибка: ${err.message || err}`);
    } finally {
      setIsTogglingAutoOpen(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  const buildSnapshotUrl = (deviceId: number | undefined) => {
    if (!selectedPlaceId || !deviceId || !credentials) return undefined;
    const params = new URLSearchParams();
    if (credentials.operatorId) params.set("operator", String(credentials.operatorId));
    params.set("token", credentials.token || "");
    params.set("t", String(localSnapshotTime));
    return `/api/domru/snapshot/${selectedPlaceId}/${deviceId}?${params.toString()}`;
  };
  return (
    <div className="space-y-6">

      {/* Smart Access Devices sections */}
      <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 ${isCompactMode ? "p-4 border-none shadow-none bg-transparent dark:bg-transparent" : "p-6 rounded-[2rem] shadow-md"}`}>
        {!isCompactMode && (
          <h2 className="text-base font-extrabold text-zinc-900 dark:text-white mb-6 font-display uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-[#E30613] rounded-full inline-block" />
            Доступы и домофоны
          </h2>
        )}

        <div className={`grid ${isCompactMode ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"} gap-6`}>
          {devices.length > 0 ? (
            devices.map((device, idx) => {
              const isOpening = openingDoorId === device.id;
              return (
                <div key={device.id || idx} className="flex flex-col gap-3">
                  <div
                    className={`relative aspect-[4/3] rounded-3xl overflow-hidden flex flex-col justify-between group transition-all duration-300 border ${
                      isOpening
                        ? "border-emerald-500 ring-2 ring-emerald-500/25 scale-98 bg-zinc-50 dark:bg-zinc-950"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100/50 dark:hover:bg-zinc-800 hover:scale-[1.01] hover:shadow-lg"
                    } ${device.allowVideo && device.externalCameraId ? "cursor-pointer" : ""}`}
                    id={`device_card_${device.id}`}
                    onClick={() => {
                      if (device.allowVideo && device.externalCameraId) {
                        setActiveCamera(device.externalCameraId);
                      }
                    }}
                  >
                    {/* Background Snapshot or Icon */}
                    <div className="absolute inset-0 bg-zinc-200/50 dark:bg-zinc-900 flex items-center justify-center pointer-events-none overflow-hidden rounded-3xl">
                      {device.allowVideo ? (
                        <>
                          <img 
                            src={buildSnapshotUrl(device.id)}
                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-90 group-hover:scale-105 transition-all duration-700"
                            alt="Снимок с камеры"
                            onError={(e) => {
                               e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none transition-opacity opacity-70 group-hover:opacity-40" />
                        </>
                      ) : (
                        <Video className="w-10 h-10 text-zinc-400 dark:text-zinc-700 opacity-40 group-hover:opacity-70 group-hover:scale-105 transition duration-300" />
                      )}
                    </div>

                    {!isCompactMode && (
                      <div className="relative z-10 bg-zinc-200/80 dark:bg-zinc-900/50 backdrop-blur-xs p-2 m-4 rounded-xl border border-zinc-300/40 dark:border-white/5 self-start max-w-[85%]">
                        <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-widest block leading-none">
                          {device.type === "intercom" ? "Домофон" : "Калитка"}
                        </span>
                        <h3 className="font-extrabold text-xs text-zinc-800 dark:text-white mt-1 truncate leading-none">
                          {device.name}
                        </h3>
                      </div>
                    )}

                    {/* Bottom action controls */}
                    {!isCompactMode && (
                      <div className="relative z-10 flex items-center justify-between w-full mt-auto p-4 pt-2">
                        {device.allowOpen && (
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (autoOpenState[device.id]) {
                                toggleAutoOpen(device.id); // turn off
                              } else {
                                setConfigModalDeviceId(device.id); // open modal
                              }
                            }}
                            disabled={isTogglingAutoOpen[device.id]}
                            title="Авто-открытие при звонке курьера"
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-full border transition flex items-center gap-1 shadow-sm cursor-pointer backdrop-blur-md ${
                              autoOpenState[device.id]
                                ? "bg-emerald-500/90 text-white border-emerald-400"
                                : "bg-white/80 dark:bg-black/60 text-zinc-700 dark:text-zinc-200 border-white/20 hover:bg-white dark:hover:bg-black/80"
                            }`}
                          >
                            {autoOpenState[device.id] ? <PhoneForwarded className="w-3.5 h-3.5" /> : <PhoneOff className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">
                              {autoOpenState[device.id] 
                                ? (typeof autoOpenState[device.id] === "number" 
                                    ? `Жду гостей/курьера (до ${new Date(autoOpenState[device.id] as number).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})` 
                                    : "Авто-открытие активно") 
                                : "Авто-открытие"}
                            </span>
                          </button>
                        )}

                        {device.allowOpen ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); if(triggerOpenDoor) triggerOpenDoor(device.id); }}
                            disabled={isOpening}
                            className={`p-2.5 rounded-full transition-all duration-300 shadow-md cursor-pointer backdrop-blur-md border ${
                              isOpening
                                ? "bg-emerald-500/90 text-white border-emerald-400 cursor-default"
                                : "bg-[#E30613]/90 hover:bg-[#c20510]/90 text-white border-white/20 active:scale-90 ml-auto"
                            }`}
                            id={`open_btn_${device.id}`}
                          >
                            {isOpening ? (
                              <Unlock className="w-4 h-4 animate-pulse" />
                            ) : (
                              <Lock className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <div className="text-[10px] text-zinc-500 italic ml-auto bg-zinc-200 dark:bg-zinc-900/80 px-2.5 py-1 rounded-lg">
                            Заблокировано
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isCompactMode && (
                    <div className="px-1 text-center">
                      <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-widest block leading-none">
                        {device.type === "intercom" ? "Домофон" : "Калитка"}
                      </span>
                      <h3 className="font-extrabold text-xs text-zinc-800 dark:text-white mt-1 line-clamp-2 leading-tight">
                        {device.name}
                      </h3>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12 text-xs text-zinc-500">
              Активные домофонные устройства не обнаружены
            </div>
          )}
        </div>
      </div>

      {doorMessage && (
        <div className="p-4 bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center gap-2 animate-fade-in max-w-md mx-auto">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{doorMessage}</span>
        </div>
      )}

      <AutoOpenConfigModal
        isOpen={configModalDeviceId !== null}
        onClose={() => setConfigModalDeviceId(null)}
        onEnable={(durationMinutes, maxOpens) => {
          if (configModalDeviceId) {
            toggleAutoOpen(configModalDeviceId, durationMinutes, maxOpens);
          }
        }}
      />
    </div>
  );
}
