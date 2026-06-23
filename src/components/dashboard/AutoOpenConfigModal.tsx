import React, { useState } from "react";
import { Clock, Check } from "lucide-react";

interface AutoOpenConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnable: (durationMinutes: number) => void;
}

export default function AutoOpenConfigModal({ isOpen, onClose, onEnable }: AutoOpenConfigModalProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(60);

  if (!isOpen) return null;

  const options = [
    { label: "На 15 минут", value: 15 },
    { label: "На 1 час", value: 60 },
    { label: "На 3 часа", value: 180 },
    { label: "До конца дня", value: getMinutesUntilEndOfDay() },
  ];

  function getMinutesUntilEndOfDay() {
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return Math.floor((endOfDay.getTime() - now.getTime()) / 60000);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in px-4">
      <div className="bg-white dark:bg-zinc-900 rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl relative animate-scale-up border border-zinc-200 dark:border-zinc-800">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white leading-tight">
              Настройка <br /> авто-открытия
            </h3>
          </div>

          <div className="space-y-2 mb-8">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedDuration(opt.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all cursor-pointer font-bold text-sm ${
                  selectedDuration === opt.value
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm"
                    : "bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{opt.label}</span>
                {selectedDuration === opt.value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              onClick={() => {
                onEnable(selectedDuration);
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              Включить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
