import { HistoryEvent } from "../../types";
import { Bell, CheckCircle } from "lucide-react";

interface EventsViewProps {
  groupedEvents: Record<string, HistoryEvent[]>;
}

export default function EventsView({ groupedEvents }: EventsViewProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-md space-y-6 animate-fade-in">


      {/* Event Log Filter pills */}
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-[11px] font-extrabold text-zinc-600 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-700/50 transition shadow-xs cursor-pointer">
          Дата
        </button>
        <button className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-[11px] font-extrabold text-zinc-600 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-700/50 transition shadow-xs cursor-pointer">
          Устройства
        </button>
        <button className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-[11px] font-extrabold text-zinc-600 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-700/50 transition shadow-xs cursor-pointer">
          Люди
        </button>
      </div>

      {/* Date-grouped list */}
      <div className="space-y-6">
        {Object.keys(groupedEvents).length > 0 ? (
          Object.entries(groupedEvents).map(([dateLabel, dateEvts]) => (
            <div key={dateLabel} className="space-y-3">
              <h4 className="text-[11px] font-extrabold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest ml-1">
                {dateLabel}
              </h4>
              <div className="space-y-2">
                {dateEvts.map((event, idx) => (
                  <div
                    key={event.id || idx}
                    className="bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-150 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-100/50 dark:hover:bg-zinc-800 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      {event.imageUrl ? (
                        <div className="w-16 h-11 bg-zinc-100 dark:bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800">
                          <img
                            src={event.imageUrl}
                            alt="Снимок вызова"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-[#E30613] shrink-0 border border-zinc-200 dark:border-zinc-800">
                          <Bell className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-zinc-800 dark:text-white leading-snug">
                          {event.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                          {event.description}
                        </p>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono font-bold block mt-1">
                          Устройство: {event.deviceName}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400 mr-1">
                      {new Date(event.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
            История вызовов пуста
          </div>
        )}
      </div>
    </div>
  );
}
