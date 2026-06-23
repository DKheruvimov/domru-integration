import { useState, useEffect } from "react";
import { SmartDevice, AppCredentials } from "../../types";
import { Video, Lock, Unlock, CheckCircle, PhoneForwarded, PhoneOff } from "lucide-react";

interface MyHomeViewProps {
  devices: SmartDevice[];
  openingDoorId: number | null;
  triggerOpenDoor: (deviceId: number) => void;
  setActiveCamera: (cameraId: string) => void;
  doorMessage: string | null;
  selectedPlaceId?: number;
  credentials?: AppCredentials;
}

export default function MyHomeView({
  devices,
  openingDoorId,
  triggerOpenDoor,
  setActiveCamera,
  doorMessage,
  selectedPlaceId,
  credentials,
}: MyHomeViewProps) {
  const [localSnapshotTime, setLocalSnapshotTime] = useState(Date.now());

  useEffect(() => {
    setLocalSnapshotTime(Date.now());
  }, [devices]);

  const [autoOpenState, setAutoOpenState] = useState<Record<number, boolean>>({});
  const [isTogglingAutoOpen, setIsTogglingAutoOpen] = useState<Record<number, boolean>>({});

  const toggleAutoOpen = async (deviceId: number) => {
    if (!selectedPlaceId) return;
    setIsTogglingAutoOpen(prev => ({ ...prev, [deviceId]: true }));
    const newState = !autoOpenState[deviceId];
    try {
      const res = await fetch("/api/domru/sip/auto-open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-domru-login": credentials?.login || "",
          "x-domru-password": credentials?.password || "",
          "x-domru-token": credentials?.token || "",
          "x-domru-operator-id": credentials?.operatorId ? String(credentials?.operatorId) : "",
          "x-domru-refresh-token": credentials?.refreshToken || "",
        },
        body: JSON.stringify({
          placeId: selectedPlaceId,
          deviceId: deviceId,
          enabled: newState,
        })
      });
      if (res.ok) {
        setAutoOpenState(prev => ({ ...prev, [deviceId]: newState }));
      }
    } catch (err) {
      console.error(err);
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-md">
        <h2 className="text-base font-extrabold text-zinc-900 dark:text-white mb-6 font-display uppercase tracking-wider flex items-center gap-2">
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

                  {/* Top bar (Address details) */}
                  <div className="relative z-10 bg-zinc-200/80 dark:bg-zinc-900/50 backdrop-blur-xs p-2 rounded-xl border border-zinc-300/40 dark:border-white/5 inline-self-start max-w-[85%]">
                    <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-widest block leading-none">
                      {device.type === "intercom" ? "Домофон" : "Калитка"}
                    </span>
                    <h3 className="font-extrabold text-xs text-zinc-800 dark:text-white mt-1 truncate leading-none">
                      {device.name}
                    </h3>
                  </div>

                  {/* Bottom action controls */}
                  <div className="relative z-10 flex items-center justify-between w-full mt-auto pt-2">
                    {device.allowOpen && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAutoOpen(device.id); }}
                        disabled={isTogglingAutoOpen[device.id]}
                        title="Авто-открытие при звонке курьера"
                        className={`px-3 py-1.5 ml-2 mr-auto text-[10px] font-bold rounded-full border transition flex items-center gap-1 shadow-sm cursor-pointer ${
                          autoOpenState[device.id]
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50"
                            : "bg-white/90 dark:bg-black/50 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        {autoOpenState[device.id] ? <PhoneForwarded className="w-3.5 h-3.5" /> : <PhoneOff className="w-3.5 h-3.5" />}
                        {autoOpenState[device.id] ? "Жду курьера" : "Авто-открытие"}
                      </button>
                    )}

                    {device.allowOpen ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); triggerOpenDoor(device.id); }}
                        disabled={openingDoorId !== null}
                        className={`p-3.5 rounded-full transition-all duration-300 ml-auto shadow-md cursor-pointer ${
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
                      <div className="text-[10px] text-zinc-500 italic ml-auto bg-zinc-200 dark:bg-zinc-900/80 px-2.5 py-1 rounded-lg">
                        Заблокировано
                      </div>
                    )}
                  </div>
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
    </div>
  );
}
