import { GuestPin } from "../../types";
import { Clock } from "lucide-react";

interface PeopleViewProps {
  pins: GuestPin[];
  makeGuestPin: () => void;
}

export default function PeopleView({ pins, makeGuestPin }: PeopleViewProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-md space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-zinc-900 dark:text-white font-display">
            Гостевые коды доступа
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Временные PIN-коды для гостей, курьеров и сотрудников служб
          </p>
        </div>
        <button
          onClick={makeGuestPin}
          className="px-4 py-2 bg-[#E30613] hover:bg-[#c20510] text-white text-xs font-extrabold rounded-full transition shadow-md shadow-[#E30613]/10 cursor-pointer"
          id="generate_pin_btn"
        >
          + Создать код
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pins.length > 0 ? (
          pins.map((pin, idx) => (
            <div
              key={pin.id || idx}
              className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-between shadow-2xs"
            >
              <div>
                <div className="text-xs font-extrabold text-zinc-800 dark:text-white">
                  {pin.name}
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                  <span>Истекает: {pin.expiresAt}</span>
                </div>
              </div>

              <div className="px-3.5 py-1.5 bg-[#E30613]/10 border border-[#E30613]/25 text-[#E30613] font-mono font-black text-sm rounded-xl tracking-wider shadow-inner">
                {pin.code}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
            Нет активных временных кодов доступа
          </div>
        )}
      </div>
    </div>
  );
}
