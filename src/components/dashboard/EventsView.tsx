import { HistoryEvent } from "../../types";
import { Bell } from "lucide-react";
import { formatTimeInTimezone } from "../../lib/timezone";

interface EventsViewProps {
  groupedEvents: Record<string, HistoryEvent[]>;
  isMobile?: boolean;
}

export default function EventsView({ groupedEvents, isMobile = false }: EventsViewProps) {
  return (
    <div className="space-y-5 animate-fade-in text-zinc-900 dark:text-white pb-6 px-1 font-sans select-none" id="events_view_root">
      {/* Header */}
      <div className="pt-2 px-1">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">События</h2>
      </div>

      {/* Filters pills */}
      <div className="flex gap-2 px-1 overflow-x-auto no-scrollbar scroll-smooth">
        <button className="px-4 py-2 bg-white dark:bg-[#161b22] text-[11px] font-extrabold text-zinc-700 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-800/60 transition active:scale-95 cursor-pointer shadow-3xs">
          Дата
        </button>
        <button className="px-4 py-2 bg-white dark:bg-[#161b22] text-[11px] font-extrabold text-zinc-700 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-800/60 transition active:scale-95 cursor-pointer shadow-3xs">
          Устройства
        </button>
        <button className="px-4 py-2 bg-white dark:bg-[#161b22] text-[11px] font-extrabold text-zinc-700 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-800/60 transition active:scale-95 cursor-pointer shadow-3xs">
          Люди
        </button>
      </div>

      {/* Date-grouped list */}
      <div className="space-y-6">
        {Object.keys(groupedEvents).length > 0 ? (
          Object.entries(groupedEvents).map(([dateLabel, dateEvts]) => (
            <div key={dateLabel} className="space-y-3">
              <h4 className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest ml-1.5">
                {dateLabel}
              </h4>
              <div className="space-y-3">
                {dateEvts.map((event, idx) => (
                  <div
                    key={event.id || idx}
                    className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/40 p-4 rounded-[1.8rem] flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition duration-200 shadow-xs"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      {event.imageUrl ? (
                        <div className="w-16 h-11 bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800/60">
                          <img
                            src={event.imageUrl}
                            alt="Снимок вызова"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-[#1b2129] flex items-center justify-center text-[#e30613] shrink-0 border border-zinc-200 dark:border-zinc-850">
                          <Bell className="w-4.5 h-4.5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate leading-snug">
                          {event.title}
                        </p>
                        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-semibold mt-0.5 leading-normal truncate">
                          {event.description}
                        </p>
                        <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-black block mt-1 uppercase tracking-wide">
                          {event.deviceName}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 ml-3">
                      {formatTimeInTimezone(event.timestamp, {
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
          <div className="text-center py-12 text-xs text-zinc-500 font-semibold">
            История вызовов пуста
          </div>
        )}
      </div>
    </div>
  );
}
