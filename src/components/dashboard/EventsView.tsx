import { useState } from "react";
import { HistoryEvent } from "../../types";
import { Bell, X, Camera, Eye } from "lucide-react";
import { formatTimeInTimezone } from "../../lib/timezone";

interface EventsViewProps {
  groupedEvents: Record<string, HistoryEvent[]>;
  isMobile?: boolean;
}

export default function EventsView({ groupedEvents, isMobile = false }: EventsViewProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>("");

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
                {dateEvts.map((event, idx) => {
                  const hasImage = !!(event.sipSnapshotUrl || event.imageUrl);
                  const displayImageUrl = event.sipSnapshotUrl || event.imageUrl;

                  return (
                    <div
                      key={event.id || idx}
                      className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/40 p-4 rounded-[1.8rem] flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition duration-200 shadow-xs"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {hasImage ? (
                          <div 
                            onClick={() => {
                              if (displayImageUrl) {
                                setSelectedImage(displayImageUrl);
                                setSelectedTitle(`${event.title} (${event.deviceName})`);
                              }
                            }}
                            className="group relative w-16 h-11 bg-zinc-100 dark:bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-800/60 cursor-pointer"
                          >
                            <img
                              src={displayImageUrl}
                              alt="Снимок"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                            {event.sipSnapshotUrl && (
                              <div className="absolute top-0.5 right-0.5 bg-[#e30613] text-white text-[7px] font-black px-1 py-0.2 rounded-xs shadow-xs uppercase tracking-wide">
                                SIP
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-[#1b2129] flex items-center justify-center text-[#e30613] shrink-0 border border-zinc-200 dark:border-zinc-850">
                            <Bell className="w-4.5 h-4.5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-extrabold text-zinc-900 dark:text-white truncate leading-snug">
                              {event.title}
                            </p>
                            {event.openedByOurService && (
                              <span className="shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[7.5px] font-black px-1.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-wide flex items-center gap-0.5">
                                {event.openedByOurService.type === "manual" ? "👇 Вручную" : "🤖 Авто"}
                              </span>
                            )}
                            {event.sipSnapshotUrl && (
                              <span className="shrink-0 bg-red-50 dark:bg-red-950/40 text-[#e30613] text-[7.5px] font-black px-1.5 py-0.5 rounded-full border border-red-100 dark:border-red-900/30 uppercase tracking-wide flex items-center gap-0.5">
                                <Camera className="w-2 h-2" /> Снимок SIP
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-semibold mt-0.5 leading-normal truncate">
                            {event.openedByOurService 
                              ? `Наш сервис: ${event.openedByOurService.details}` 
                              : event.description}
                          </p>
                          <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-black block mt-1 uppercase tracking-wide">
                            {event.deviceName}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 ml-3">
                          {formatTimeInTimezone(event.timestamp, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {/* Debug Info */}
                        {(event as any).debug_closestSnapshotDiffMs !== undefined && (
                          <span className="text-[8px] text-red-500">Diff: {Math.round((event as any).debug_closestSnapshotDiffMs / 60000)}m</span>
                        )}
                        {(event as any).debug_error && (
                          <span className="text-[8px] text-red-500">{(event as any).debug_error}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-xs text-zinc-500 font-semibold">
            История вызовов пуста
          </div>
        )}
      </div>

      {/* Modern Backdrop Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-zinc-900/90 dark:bg-[#161b22]/95 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Info bar */}
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-black text-zinc-300 tracking-wide uppercase truncate mr-4">
                {selectedTitle}
              </span>
              <button 
                onClick={() => setSelectedImage(null)}
                className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image viewer */}
            <div className="aspect-[4/3] w-full bg-black relative flex items-center justify-center">
              <img 
                src={selectedImage} 
                alt="Полный снимок" 
                referrerPolicy="no-referrer"
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>

            {/* Footer with storage and source information */}
            <div className="px-6 py-4 bg-zinc-950/40 text-center">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                Снимок сохранен на сервере • Хранится 30 дней
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
