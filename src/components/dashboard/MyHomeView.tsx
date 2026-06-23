import { useState, useEffect } from "react";
import { SmartDevice, AppCredentials } from "../../types";
import { Video, CheckCircle } from "lucide-react";

interface MyHomeViewProps {
  devices: SmartDevice[];
  setActiveCamera: (cameraId: string) => void;
  doorMessage: string | null;
  selectedPlaceId?: number;
  credentials?: AppCredentials;
}

export default function MyHomeView({
  devices,
  setActiveCamera,
  doorMessage,
  selectedPlaceId,
  credentials,
}: MyHomeViewProps) {
  const [localSnapshotTime, setLocalSnapshotTime] = useState(Date.now());

  useEffect(() => {
    setLocalSnapshotTime(Date.now());
  }, [devices]);



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
