import { SmartDevice } from "../../types";
import { Video, Lock, Unlock, CheckCircle, ShieldCheck } from "lucide-react";

interface MyHomeViewProps {
  devices: SmartDevice[];
  openingDoorId: number | null;
  triggerOpenDoor: (deviceId: number) => void;
  setActiveCamera: (cameraId: string) => void;
  doorMessage: string | null;
}

export default function MyHomeView({
  devices,
  openingDoorId,
  triggerOpenDoor,
  setActiveCamera,
  doorMessage,
}: MyHomeViewProps) {
  return (
    <div className="space-y-6">
      {/* Announcements Banners matching the mobile style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Banner 1 */}
        <div className="bg-gradient-to-r from-purple-55 via-indigo-55/50 to-red-50/30 dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-[#E30613]/10 border border-purple-100 dark:border-indigo-900/30 p-5 rounded-3xl relative overflow-hidden flex justify-between items-center group shadow-md">
          <div className="space-y-2 z-10 max-w-[68%]">
            <h3 className="font-extrabold text-purple-950 dark:text-white text-base tracking-tight leading-tight">
              Подключайте тариф ПРО
            </h3>
            <p className="text-xs text-purple-900/70 dark:text-zinc-300 leading-normal">
              Предложение специально для вас: неограниченный видеоархив и расширенный доступ.
            </p>
            <button className="mt-2.5 px-4 py-2 bg-purple-650 hover:bg-purple-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-full text-xs font-bold transition shadow-xs cursor-pointer">
              Подключить
            </button>
          </div>
          <div className="text-5xl select-none transform group-hover:rotate-6 transition duration-300 z-10 pr-2">
            📦
          </div>
        </div>

        {/* Banner 2 */}
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 p-5 rounded-3xl flex justify-between items-center group shadow-md">
          <div className="space-y-2 z-10 max-w-[70%]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
              <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm tracking-tight leading-tight">
                Подтвердите ваши ключи
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-normal">
              Подтвердите достоверность ключей для корректной работы сервисов безопасности.
            </p>
            <button className="mt-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-full text-xs font-bold transition shadow-xs cursor-pointer">
              Подтвердить
            </button>
          </div>
          <div className="text-4xl opacity-30 group-hover:opacity-50 transition duration-300 pr-2 select-none">
            🛡️
          </div>
        </div>
      </div>

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
                  }`}
                  id={`device_card_${device.id}`}
                >
                  {/* Film/Video strip placeholder background */}
                  <div className="absolute inset-0 bg-zinc-100/60 dark:bg-zinc-900/70 flex items-center justify-center pointer-events-none group-hover:bg-zinc-100/80 group-hover:dark:bg-zinc-900/60 transition">
                    <Video className="w-10 h-10 text-zinc-400 dark:text-zinc-700 opacity-40 group-hover:opacity-70 group-hover:scale-105 transition duration-300" />
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
                    {device.allowVideo && device.externalCameraId && (
                      <button
                        onClick={() => setActiveCamera(device.externalCameraId)}
                        className="px-3 py-1.5 bg-white/90 dark:bg-black/50 hover:bg-zinc-100 dark:hover:bg-black/75 text-zinc-800 dark:text-white text-[10px] font-bold rounded-full border border-zinc-200 dark:border-white/5 transition flex items-center gap-1 leading-none shadow-sm cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5 text-[#E30613]" />
                        Смотреть
                      </button>
                    )}

                    {device.allowOpen ? (
                      <button
                        onClick={() => triggerOpenDoor(device.id)}
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
