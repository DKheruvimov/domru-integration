import { SmartPlace } from "../../types";
import {
  CreditCard,
  KeyRound,
  MessageSquare,
  Bell,
  Clock,
  ChevronRight,
  LogOut,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

interface CabinetViewProps {
  selectedPlace: SmartPlace | null;
  onLogout: () => void;
  isMobile?: boolean;
}

export default function CabinetView({ selectedPlace, onLogout, isMobile = false }: CabinetViewProps) {
  if (isMobile) {
    return (
      <div className="space-y-5 animate-fade-in text-zinc-900 dark:text-white pb-6 px-1 font-sans select-none" id="mobile_cabinet_view">
        {/* Top Header */}
        <div className="pt-2 px-1">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Личный кабинет</h2>
        </div>

        {/* Contract & Balance Card */}
        <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 p-5 rounded-[2rem] shadow-lg space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block leading-none">
                Договор {selectedPlace?.accountId || "520900240557"}
              </span>
              <div className="flex items-center gap-1.5 mt-2 leading-none">
                <span className="text-sm font-extrabold text-zinc-800 dark:text-white">Услуги активны</span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 dark:border-zinc-800/80 pt-4.5">
            <div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-extrabold uppercase tracking-wider block">
                Баланс
              </span>
              <span className="font-sans font-black text-2xl text-zinc-900 dark:text-white block mt-1 leading-none">
                {selectedPlace ? selectedPlace.balance.toFixed(2) : "0"}{" "}
                <span className="text-base font-bold text-zinc-500 dark:text-zinc-400">₽</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-extrabold uppercase tracking-wider block">
                Следующий платёж
              </span>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mt-2.5 leading-none">
                {selectedPlace ? selectedPlace.paymentPeriod : "Нет счетов"}
              </span>
            </div>
          </div>

          <button className="w-full py-3 bg-[#e30613] hover:bg-red-600 active:scale-98 transition-all text-white rounded-full text-xs font-black shadow-md shadow-red-600/10 flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer">
            <CreditCard className="w-4.5 h-4.5" />
            Пополнить баланс
          </button>
        </div>

        {/* List items with chevrons */}
        <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-[2rem] shadow-lg overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800/50">
          <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
            <div className="flex items-center gap-3">
              <KeyRound className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>Мои ключи</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>Помощь</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
            <div className="flex items-center gap-3">
              <Bell className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>Уведомления</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
            <div className="flex items-center gap-3">
              <Clock className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>О приложении</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
          <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>Разрешения в приложении</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>
        </div>

        {/* Bottom item: Оплата услуг */}
        <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-[1.8rem] p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
          <div className="flex items-center gap-3">
            <CreditCard className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
            <span>Оплата услуг</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="w-full py-4 border border-red-500/20 hover:border-red-500/30 text-xs font-bold text-red-500 dark:text-red-400 rounded-2xl hover:bg-red-500/5 transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
          id="logout_btn"
        >
          <LogOut className="w-4 h-4" />
          Выйти из аккаунта
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Account Info Badge */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-md space-y-5">
        <div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block leading-none">
            Договор {selectedPlace?.accountId || "—"}
          </span>
          <div className="flex items-center gap-2 mt-1.5 leading-none">
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
              Услуги активны
            </h3>
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
              Текущий баланс
            </span>
            <span className="font-display font-black text-3xl text-zinc-900 dark:text-white block mt-1.5 leading-none">
              {selectedPlace ? selectedPlace.balance.toFixed(2) : "0.00"}{" "}
              <span className="text-xl font-semibold text-zinc-500 dark:text-zinc-400">₽</span>
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
              Порог списания
            </span>
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mt-3 leading-none">
              {selectedPlace ? selectedPlace.paymentPeriod : "Нет счетов"}
            </span>
          </div>
        </div>

        <button className="w-full mt-2 py-3 bg-[#E30613] hover:bg-[#c20510] active:scale-98 transition text-white rounded-xl text-xs font-bold shadow-md shadow-[#E30613]/15 flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer">
          <CreditCard className="w-4 h-4" />
          Пополнить баланс
        </button>
      </div>

      {/* List options matching the screenshots */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-md overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800/80">
        <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition">
          <div className="flex items-center gap-3">
            <KeyRound className="w-4.5 h-4.5 text-[#E30613]" />
            <span>Мои ключи</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-4.5 h-4.5 text-[#E30613]" />
            <span>Помощь и поддержка</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition">
          <div className="flex items-center gap-3">
            <Bell className="w-4.5 h-4.5 text-[#E30613]" />
            <span>Уведомления</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>
        <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition">
          <div className="flex items-center gap-3">
            <Clock className="w-4.5 h-4.5 text-[#E30613]" />
            <span>О приложении</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>
      </div>

      {/* Logout button */}
      <button
        onClick={onLogout}
        className="w-full py-3.5 border border-red-500/25 hover:border-red-500/40 text-xs font-bold text-red-500 dark:text-red-400 rounded-2xl hover:bg-red-500/5 transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs font-sans uppercase tracking-wider"
        id="logout_btn"
      >
        <LogOut className="w-4 h-4" />
        Выйти из аккаунта
      </button>
    </div>
  );
}
