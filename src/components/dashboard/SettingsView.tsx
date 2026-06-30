import { useState, useEffect } from "react";
import { SmartPlace, AppCredentials } from "../../types";
import Integrations from "../Integrations";
import CodeBrowser from "../CodeBrowser";
import {
  CreditCard,
  KeyRound,
  Bell,
  Clock,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Globe,
  Settings,
  Cpu,
  RefreshCw,
  Lock,
  Unlock,
  Blocks,
  FolderCode,
  User,
  X,
  Info,
  ShieldAlert,
} from "lucide-react";

declare const __APP_VERSION__: string;

interface SettingsViewProps {
  selectedPlace: SmartPlace | null;
  onLogout: () => void;
  isMobile?: boolean;
  theme?: "light" | "dark" | "system";
  setTheme?: (theme: "light" | "dark" | "system") => void;
  isDevModeEnabled?: boolean;
  setIsDevModeEnabled?: (enabled: boolean) => void;
  timezone?: string;
  setTimezone?: (tz: string) => void;
  useWebRTC?: boolean;
  setUseWebRTC?: (enabled: boolean) => void;
  credentials?: AppCredentials;
}

const timezones = [
  { id: "Europe/Kaliningrad", name: "Калининград (UTC+2)" },
  { id: "Europe/Moscow", name: "Москва (UTC+3)" },
  { id: "Europe/Samara", name: "Самара (UTC+4)" },
  { id: "Asia/Yekaterinburg", name: "Екатеринбург (UTC+5)" },
  { id: "Asia/Omsk", name: "Омск (UTC+6)" },
  { id: "Asia/Novosibirsk", name: "Новосибирск (UTC+7)" },
  { id: "Asia/Irkutsk", name: "Иркутск (UTC+8)" },
  { id: "Asia/Yakutsk", name: "Якутск (UTC+9)" },
  { id: "Asia/Vladivostok", name: "Владивосток (UTC+10)" },
  { id: "Asia/Magadan", name: "Магадан (UTC+11)" },
  { id: "Asia/Kamchatka", name: "Камчатка (UTC+12)" },
];

export default function SettingsView({
  selectedPlace,
  onLogout,
  isMobile = false,
  theme = "system",
  setTheme = () => {},
  isDevModeEnabled = false,
  setIsDevModeEnabled = () => {},
  timezone = "Europe/Moscow",
  setTimezone = () => {},
  useWebRTC = false,
  setUseWebRTC = () => {},
  credentials,
}: SettingsViewProps) {
  const [settingsTab, setSettingsTab] = useState<string>("account");
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [autoOpenDelayResidentMs, setAutoOpenDelayResidentMs] = useState<number>(0);
  const [autoOpenDelayGuestMs, setAutoOpenDelayGuestMs] = useState<number>(3000);

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (typeof data.autoOpenDelayResidentMs === "number") setAutoOpenDelayResidentMs(data.autoOpenDelayResidentMs);
          if (typeof data.autoOpenDelayGuestMs === "number") setAutoOpenDelayGuestMs(data.autoOpenDelayGuestMs);
        }
      })
      .catch(err => console.error("Failed to load settings", err));
  }, []);

  const saveSettings = (newResidentDelay: number, newGuestDelay: number) => {
    setAutoOpenDelayResidentMs(newResidentDelay);
    setAutoOpenDelayGuestMs(newGuestDelay);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        autoOpenDelayResidentMs: newResidentDelay,
        autoOpenDelayGuestMs: newGuestDelay
      }),
    }).catch(err => console.error("Failed to save settings", err));
  };

  // Local keys management
  const [keysList, setKeysList] = useState([
    { id: "4A8F9312", name: "Основной ключ (Мама)", active: true },
    { id: "8B3C42D0", name: "Детский брелок (Алексей)", active: true },
    { id: "2C7E55F9", name: "Резервный ключ", active: false },
  ]);
  const [guestCode, setGuestCode] = useState("1409");

  const toggleKey = (id: string) => {
    setKeysList((prev) =>
      prev.map((k) => (k.id === id ? { ...k, active: !k.active } : k))
    );
  };

  const generateNewCode = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGuestCode(code);
  };

  return (
    <div className={`animate-fade-in ${isMobile ? "space-y-4" : "flex gap-8 items-start h-full"}`}>
      {/* Navigation Menu */}
      {isMobile ? (
        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl gap-1 border border-zinc-200/40 dark:border-zinc-800/60 overflow-x-auto select-none no-scrollbar">
          {["account", "keys", "general", "notifications", "integrations", "developer", "inspector"].map((tab) => {
            if (tab === "inspector" && !isDevModeEnabled) return null;
            const labels: Record<string, string> = {
              account: "Аккаунт",
              keys: "Ключи",
              general: "Общие",
              notifications: "Уведомления",
              integrations: "Интеграции",
              developer: "Разработчик",
              inspector: "Инспектор",
            };
            return (
              <button
                key={tab}
                onClick={() => setSettingsTab(tab as any)}
                className={`py-2 px-4 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap text-center shrink-0 ${
                  settingsTab === tab
                    ? "bg-white dark:bg-zinc-700 text-[#e30613] shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="w-[240px] shrink-0 space-y-4 bg-zinc-100/60 dark:bg-zinc-900/40 border border-zinc-200/40 dark:border-zinc-800/60 p-4 rounded-3xl flex flex-col justify-between self-stretch h-[calc(100vh-140px)]">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3 px-1">
              Управление
            </span>
            <button
              onClick={() => setSettingsTab("account")}
              className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                settingsTab === "account"
                  ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Аккаунт и оплата</span>
            </button>
            <button
              onClick={() => setSettingsTab("keys")}
              className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                settingsTab === "keys"
                  ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <KeyRound className="w-4 h-4 shrink-0" />
              <span>Мои ключи</span>
            </button>
            <button
              onClick={() => setSettingsTab("general")}
              className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                settingsTab === "general"
                  ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Общие настройки</span>
            </button>
            <button
              onClick={() => setSettingsTab("notifications")}
              className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                settingsTab === "notifications"
                  ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <Bell className="w-4 h-4 shrink-0" />
              <span>Уведомления</span>
            </button>
            <button
              onClick={() => setSettingsTab("integrations")}
              className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                settingsTab === "integrations"
                  ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <Blocks className="w-4 h-4 shrink-0" />
              <span>Интеграции</span>
            </button>
            
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mt-6 mb-3 px-1">
              Система
            </span>
            <button
              onClick={() => setSettingsTab("developer")}
              className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                settingsTab === "developer"
                  ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0" />
              <span>Разработчик</span>
            </button>
            {isDevModeEnabled && (
              <button
                onClick={() => setSettingsTab("inspector")}
                className={`w-full text-left py-2.5 px-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  settingsTab === "inspector"
                    ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                <FolderCode className="w-4 h-4 shrink-0" />
                <span>Инспектор SDK</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className={`flex-1 ${isMobile ? "" : "h-[calc(100vh-140px)] overflow-y-auto pr-2"} pb-10`}>
        {settingsTab === "account" && (
          <div className="space-y-6 animate-fade-in max-w-2xl">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-[2rem] shadow-lg space-y-6">
              <div>
                <span className="text-xs font-black text-zinc-500 uppercase tracking-widest block leading-none">
                  Договор {selectedPlace?.accountId || "—"}
                </span>
                <div className="flex items-center gap-2 mt-2 leading-none">
                  <h3 className="font-extrabold text-xl text-zinc-900 dark:text-white">
                    Услуги активны
                  </h3>
                  <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <div>
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider block">
                    Текущий баланс
                  </span>
                  <span className="font-display font-black text-4xl text-zinc-900 dark:text-white block mt-2 leading-none">
                    {selectedPlace ? selectedPlace.balance.toFixed(2) : "0.00"}{" "}
                    <span className="text-2xl font-semibold text-zinc-500 dark:text-zinc-400">₽</span>
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider block">
                    Следующий платёж
                  </span>
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 block mt-4 leading-none">
                    {selectedPlace ? selectedPlace.paymentPeriod : "Нет счетов"}
                  </span>
                </div>
              </div>

              <button className="w-full sm:w-auto mt-6 py-3 px-6 bg-[#E30613] hover:bg-[#c20510] active:scale-98 transition text-white rounded-xl text-[11px] font-extrabold shadow-md shadow-[#E30613]/20 flex items-center justify-center gap-1.5 uppercase cursor-pointer">
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>Пополнить баланс</span>
              </button>
            </div>

            <button
              onClick={onLogout}
              className="w-full sm:w-auto px-6 py-3 border border-red-500/25 hover:border-red-500/40 text-[11px] font-extrabold text-red-500 dark:text-red-400 rounded-xl hover:bg-red-500/5 transition flex items-center justify-center gap-1.5 cursor-pointer uppercase"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Выйти из аккаунта</span>
            </button>
          </div>
        )}

        {settingsTab === "keys" && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-5 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-850 rounded-3xl text-sm text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
              Вы можете временно приостановить действие физических ключей от вашего подъезда, а также сгенерировать временный цифровой код гостя.
            </div>

            <div className="space-y-4">
              <span className="text-xs text-zinc-500 font-black uppercase tracking-widest block pl-2">
                Физические ключи ({keysList.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keysList.map((k) => (
                  <div
                    key={k.id}
                    className="p-5 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-3xl flex items-center justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <KeyRound className="w-5 h-5 text-zinc-400" />
                        <span className="text-sm font-bold text-zinc-800 dark:text-white">
                          {k.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 pl-7.5 block mt-1">
                        ID: {k.id}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleKey(k.id)}
                      className={`px-3.5 py-2.5 rounded-xl text-[11px] font-extrabold uppercase transition flex items-center gap-1.5 cursor-pointer active:scale-95 border ${
                        k.active
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {k.active ? (
                        <>
                          <Unlock className="w-4 h-4" /> Активен
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" /> Блок
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#e30613]/5 border border-[#e30613]/10 p-6 rounded-3xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <span className="text-xs text-[#e30613] font-black uppercase tracking-wider block">
                    Временный код гостя
                  </span>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 font-semibold">
                    Подходит для курьеров и гостей на панели домофона.
                  </p>
                </div>
                <div className="text-3xl font-black font-mono tracking-wider text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-5 py-3 rounded-2xl shadow-sm text-center">
                  {guestCode}
                </div>
              </div>

              <button
                onClick={generateNewCode}
                className="w-full md:w-auto px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-extrabold uppercase rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-98"
              >
                <RefreshCw className="w-4 h-4 shrink-0" /> 
                <span>Сгенерировать новый код</span>
              </button>
            </div>
          </div>
        )}

        {settingsTab === "general" && (
          <div className="space-y-8 animate-fade-in max-w-3xl">
            <div className="space-y-4">
              <span className="text-xs text-zinc-500 font-black uppercase tracking-widest block px-1">
                Тема оформления
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setTheme("light")}
                  className={`p-3 rounded-3xl border text-left flex flex-col items-center justify-center gap-3 transition cursor-pointer active:scale-[0.99] ${
                    theme === "light"
                      ? "bg-[#e30613]/5 dark:bg-[#e30613]/10 border-[#e30613]/35 text-[#e30613] shadow-md shadow-[#e30613]/5"
                      : "bg-white dark:bg-[#161b22] border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Sun className="w-6 h-6" />
                  <span className="text-sm font-bold">Светлая</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`p-3 rounded-3xl border text-left flex flex-col items-center justify-center gap-3 transition cursor-pointer active:scale-[0.99] ${
                    theme === "dark"
                      ? "bg-[#e30613]/5 dark:bg-[#e30613]/10 border-[#e30613]/35 text-[#e30613] shadow-md shadow-[#e30613]/5"
                      : "bg-white dark:bg-[#161b22] border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Moon className="w-6 h-6" />
                  <span className="text-sm font-bold">Тёмная</span>
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`p-3 rounded-3xl border text-left flex flex-col items-center justify-center gap-3 transition cursor-pointer active:scale-[0.99] ${
                    theme === "system"
                      ? "bg-[#e30613]/5 dark:bg-[#e30613]/10 border-[#e30613]/35 text-[#e30613] shadow-md shadow-[#e30613]/5"
                      : "bg-white dark:bg-[#161b22] border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Monitor className="w-6 h-6" />
                  <span className="text-sm font-bold">Системная</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-xs text-zinc-500 font-black uppercase tracking-widest block px-1">
                Часовой пояс
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {timezones.map((tz) => (
                  <button
                    key={tz.id}
                    onClick={() => setTimezone(tz.id)}
                    className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer active:scale-99 ${
                      timezone === tz.id
                        ? "bg-[#e30613]/5 dark:bg-[#e30613]/10 border-[#e30613]/35 text-[#e30613] shadow-md shadow-[#e30613]/5"
                        : "bg-white dark:bg-[#161b22] border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 shrink-0 opacity-50" />
                      <span className="text-sm font-bold block">{tz.name}</span>
                    </div>
                    {timezone === tz.id && <div className="w-2.5 h-2.5 shrink-0 bg-[#e30613] rounded-full" />}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => setIsAboutOpen(true)}
              className="w-full p-5 flex items-center justify-between text-sm font-bold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/60 rounded-3xl hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#e30613] dark:text-zinc-400" />
                <span>О приложении</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                <span className="font-semibold text-zinc-450">v{__APP_VERSION__}</span>
              </div>
            </button>
          </div>
        )}

        {settingsTab === "notifications" && (
          <div className="space-y-6 animate-fade-in max-w-2xl">
            <div className="p-6 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-3xl space-y-6 shadow-sm">
              <div className="space-y-2 mb-6">
                <span className="text-sm font-extrabold text-zinc-800 dark:text-white block">
                  Задержка перед автооткрытием (Жильцы)
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold block leading-relaxed">
                  Время ожидания для жильцов. Можно поставить 0, чтобы дверь открывалась моментально без звонка на панели домофона.
                </span>
              </div>
              <div className="flex items-center gap-5">
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={autoOpenDelayResidentMs / 1000}
                  onChange={(e) => saveSettings(Number(e.target.value) * 1000, autoOpenDelayGuestMs)}
                  className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#e30613]"
                />
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 w-10 text-right shrink-0 bg-zinc-100 dark:bg-zinc-800 py-1.5 rounded-lg">
                  {autoOpenDelayResidentMs / 1000} с
                </span>
              </div>
              
              <div className="space-y-2 mb-6 mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-sm font-extrabold text-zinc-800 dark:text-white block">
                  Задержка перед автооткрытием (Гости/Курьеры)
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold block leading-relaxed">
                  Время ожидания для гостей и курьеров. Домашние успеют услышать звонок в домофон перед автоматическим открытием.
                </span>
              </div>
              <div className="flex items-center gap-5">
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={autoOpenDelayGuestMs / 1000}
                  onChange={(e) => saveSettings(autoOpenDelayResidentMs, Number(e.target.value) * 1000)}
                  className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-[#e30613]"
                />
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 w-10 text-right shrink-0 bg-zinc-100 dark:bg-zinc-800 py-1.5 rounded-lg">
                  {autoOpenDelayGuestMs / 1000} с
                </span>
              </div>
            </div>
          </div>
        )}

        {settingsTab === "developer" && (
          <div className="space-y-6 animate-fade-in max-w-2xl">
            <div className="p-6 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-3xl space-y-4 shadow-sm flex items-center justify-between gap-6">
              <div className="space-y-1.5">
                <span className="text-sm font-extrabold text-zinc-800 dark:text-white block">
                  Режим разработчика
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold block leading-relaxed">
                  Включает технические логи, средства диагностики и дополнительные вкладки (Инспектор SDK).
                </span>
              </div>
              
              <button
                onClick={() => setIsDevModeEnabled(!isDevModeEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isDevModeEnabled ? "bg-[#e30613]" : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                    isDevModeEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {isDevModeEnabled && (
              <>
                <div className="p-6 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-3xl space-y-4 shadow-sm animate-fade-in flex items-center justify-between gap-6">
                  <div className="space-y-1.5">
                    <span className="text-sm font-extrabold text-zinc-800 dark:text-white block">
                      Использовать WebRTC (UDP)
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold block leading-relaxed">
                      Трансляция без задержек. Использование UDP может привести к блокировке IP-адреса строгими брандмауэрами.
                    </span>
                  </div>
                  
                  <button
                    onClick={() => setUseWebRTC(!useWebRTC)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      useWebRTC ? "bg-[#e30613]" : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        useWebRTC ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-3xl overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800/50 shadow-sm animate-fade-in">
                  <div className="p-4 px-6 flex items-center justify-between text-sm font-semibold">
                    <span className="text-zinc-500 dark:text-zinc-400">Модель SDK</span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">domru-js v2.0.1</span>
                  </div>
                  <div className="p-4 px-6 flex items-center justify-between text-sm font-semibold">
                    <span className="text-zinc-500 dark:text-zinc-400">Формат потока</span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">{useWebRTC ? "WebRTC" : "HLS"}</span>
                  </div>
                  <div className="p-4 px-6 flex items-center justify-between text-sm font-semibold">
                    <span className="text-zinc-500 dark:text-zinc-400">Устройство</span>
                    <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">{isMobile ? "Mobile UI" : "Desktop UI"}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {settingsTab === "integrations" && (
          <div className="animate-fade-in w-full h-full">
            <Integrations credentials={credentials || { login: "demo", isDemo: true }} />
          </div>
        )}

        {settingsTab === "inspector" && isDevModeEnabled && (
          <div className="animate-fade-in w-full h-full">
            <CodeBrowser />
          </div>
        )}
      </div>

      {/* About Modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col relative">
            <button
              onClick={() => setIsAboutOpen(false)}
              className="absolute top-4 right-4 p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-8 space-y-6">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 bg-[#E30613] rounded-2xl flex items-center justify-center shadow-lg shadow-[#E30613]/20">
                  <span className="font-display font-black text-3xl text-white">дом</span>
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white">Умный Дом Дом.ru</h2>
                  <span className="text-sm font-bold text-zinc-500">Версия {__APP_VERSION__}</span>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                  <strong className="text-zinc-900 dark:text-white font-extrabold">Действительно умный клиент домофона Дом.ru</strong> — это приложение, созданное для объединения разрозненных экосистем. Оно предлагает быстрый, современный интерфейс и открывает доступ к глубокой интеграции с другими сервисами.
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                  С его помощью можно автоматизировать работу домофона, настроить гибкие правила автооткрытия, а главное — легко интегрировать устройства в систему <strong>Умного дома Яндекса</strong> (Алису) и другие платформы домашней автоматизации.
                </p>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-500/90 font-semibold leading-relaxed">
                  Данное приложение является неофициальным клиентом, разработанным энтузиастами. Оно никак не связано с провайдером Дом.ru («ЭР-Телеком»).
                </p>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm text-red-600 dark:text-red-500/90 font-semibold leading-relaxed">
                    Приложение использует закрытое API «Дом.ru», полученное методом обратной разработки. Авторы не несут ответственности за возможные блокировки аккаунта со стороны провайдера.
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-500/90 font-semibold leading-relaxed">
                    Клиент рассчитан исключительно на <strong>личное использование</strong> и не спроектирован для безопасной работы множества пользователей (multi-user). Несмотря на механизмы работы с токенами, автор не несёт ответственности за сохранность и перехват ваших авторизационных данных.
                  </p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/80 text-center">
                <p className="text-xs text-zinc-400 font-medium">
                  Исходный код доступен на GitHub.<br />
                  © 2026 Неофициальный клиент Умного Дома.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
