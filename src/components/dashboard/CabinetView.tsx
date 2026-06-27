import { useState, useEffect } from "react";
import { SmartPlace, AppCredentials } from "../../types";
import Integrations from "../Integrations";
import CodeBrowser from "../CodeBrowser";
import {
  CreditCard,
  KeyRound,
  Bell,
  Clock,
  ChevronRight,
  LogOut,
  ChevronLeft,
  Sun,
  Moon,
  Monitor,
  Globe,
  Settings,
  Cpu,
  ShieldCheck,
  Zap,
  Smartphone,
  Hash,
  Activity,
  RefreshCw,
  Lock,
  Unlock,
  Blocks,
  FolderCode,
} from "lucide-react";

interface CabinetViewProps {
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
  onSubScreenChange?: (screen: string | null) => void;
}

const timezones = [
  { id: "Europe/Kaliningrad", name: "Калининград (UTC+2)", city: "Калининград" },
  { id: "Europe/Moscow", name: "Москва (UTC+3)", city: "Москва, С-Пб, Казань" },
  { id: "Europe/Samara", name: "Самара (UTC+4)", city: "Самара, Ижевск" },
  { id: "Asia/Yekaterinburg", name: "Екатеринбург (UTC+5)", city: "Екатеринбург, Тюмень" },
  { id: "Asia/Omsk", name: "Омск (UTC+6)", city: "Омск" },
  { id: "Asia/Novosibirsk", name: "Новосибирск (UTC+7)", city: "Новосибирск, Красноярск" },
  { id: "Asia/Irkutsk", name: "Иркутск (UTC+8)", city: "Иркутск" },
  { id: "Asia/Yakutsk", name: "Якутск (UTC+9)", city: "Якутск" },
  { id: "Asia/Vladivostok", name: "Владивосток (UTC+10)", city: "Владивосток, Хабаровск" },
  { id: "Asia/Magadan", name: "Магадан (UTC+11)", city: "Магадан" },
  { id: "Asia/Kamchatka", name: "Камчатка (UTC+12)", city: "Петропавловск-Камчатский" },
];

export default function CabinetView({
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
  onSubScreenChange,
}: CabinetViewProps) {
  const [activeSubScreen, setActiveSubScreenInternal] = useState<null | "keys" | "theme" | "dev" | "timezone">(null);
  const [devTab, setDevTab] = useState<"diagnostics" | "integrations" | "inspector">("diagnostics");

  const setActiveSubScreen = (screen: null | "keys" | "theme" | "dev" | "timezone") => {
    setActiveSubScreenInternal(screen);
    if (onSubScreenChange) {
      onSubScreenChange(screen);
    }
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

  // Live clock based on current timezone
  const [liveTime, setLiveTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      try {
        const d = new Date();
        const timeStr = d.toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: timezone,
        });
        setLiveTime(timeStr);
      } catch (e) {
        setLiveTime(new Date().toLocaleTimeString("ru-RU"));
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  // Handle Back key
  const handleBack = () => setActiveSubScreen(null);

  // If we are inside a sub-screen, render it nicely with smooth back navigation transition
  if (activeSubScreen !== null) {
    return (
      <div className="space-y-5 animate-fade-in text-zinc-900 dark:text-white pb-6 px-1 font-sans select-none">
        {/* Back navigation header */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleBack}
            className="p-2 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700/80 rounded-full text-zinc-650 dark:text-zinc-300 cursor-pointer active:scale-95 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-base font-extrabold tracking-tight">
              {activeSubScreen === "keys" && "Мои ключи"}
              {activeSubScreen === "theme" && "Тема оформления"}
              {activeSubScreen === "dev" && "Режим разработчика"}
              {activeSubScreen === "timezone" && "Часовой пояс"}
            </h3>
            <span className="text-[10px] text-[#e30613] font-bold uppercase tracking-wider block">
              Личный кабинет • Настройки
            </span>
          </div>
        </div>

        {/* 1. MY KEYS SUB-SCREEN */}
        {activeSubScreen === "keys" && (
          <div className="space-y-4 animate-scale-up">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-850 rounded-2xl text-xs text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
              Вы можете временно приостановить действие физических ключей от вашего подъезда, а также сгенерировать временный цифровой код гостя.
            </div>

            <div className="space-y-3">
              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block pl-1">
                Физические ключи ({keysList.length})
              </span>
              <div className="space-y-2.5">
                {keysList.map((k) => (
                  <div
                    key={k.id}
                    className="p-4 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-bold text-zinc-800 dark:text-white">
                          {k.name}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400 pl-6 block mt-0.5">
                        ID брелка: {k.id}
                      </span>
                    </div>

                    <button
                      onClick={() => toggleKey(k.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer active:scale-95 border ${
                        k.active
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {k.active ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" /> Активен
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" /> Блок
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Temporary guest code */}
            <div className="bg-[#e30613]/5 border border-[#e30613]/10 p-5 rounded-2xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#e30613] font-black uppercase tracking-wider block">
                    Временный код гостя
                  </span>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
                    Подходит для курьеров и гостей на панели домофона.
                  </p>
                </div>
                <div className="text-2xl font-black font-mono tracking-wider text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl leading-none">
                  {guestCode}
                </div>
              </div>

              <button
                onClick={generateNewCode}
                className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer transition active:scale-98"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Сгенерировать новый код
              </button>
            </div>
          </div>
        )}

        {/* 2. THEME SELECTOR SUB-SCREEN */}
        {activeSubScreen === "theme" && (
          <div className="space-y-3.5 animate-scale-up">
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setTheme("light")}
                className={`p-4 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${
                  theme === "light"
                    ? "bg-[#e30613]/5 dark:bg-[#e30613]/10 border-[#e30613]/35 text-[#e30613] shadow-xs"
                    : "bg-white dark:bg-[#161b22] border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold block">Светлая тема</span>
                    <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                      Стандартный светлый режим
                    </span>
                  </div>
                </div>
                {theme === "light" && <div className="w-2.5 h-2.5 bg-[#e30613] rounded-full" />}
              </button>

              <button
                onClick={() => setTheme("dark")}
                className={`p-4 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${
                  theme === "dark"
                    ? "bg-[#e30613]/5 dark:bg-[#e30613]/10 border-[#e30613]/35 text-[#e30613] shadow-xs"
                    : "bg-white dark:bg-[#161b22] border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold block">Тёмная тема</span>
                    <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                      Защита глаз в тёмное время суток
                    </span>
                  </div>
                </div>
                {theme === "dark" && <div className="w-2.5 h-2.5 bg-[#e30613] rounded-full" />}
              </button>

              <button
                onClick={() => setTheme("system")}
                className={`p-4 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer active:scale-[0.99] ${
                  theme === "system"
                    ? "bg-[#e30613]/5 dark:bg-[#e30613]/10 border-[#e30613]/35 text-[#e30613] shadow-xs"
                    : "bg-white dark:bg-[#161b22] border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-extrabold block">Системная тема</span>
                    <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                      Синхронизация с настройками ОС
                    </span>
                  </div>
                </div>
                {theme === "system" && <div className="w-2.5 h-2.5 bg-[#e30613] rounded-full" />}
              </button>
            </div>
          </div>
        )}

        {/* 3. TIMEZONE SELECTOR SUB-SCREEN */}
        {activeSubScreen === "timezone" && (
          <div className="space-y-4 animate-scale-up">
            {/* Live Clock display */}
            <div className="bg-zinc-900/90 text-white p-5 rounded-[2rem] text-center border border-zinc-800 space-y-1.5 shadow-xl">
              <span className="text-[9px] text-[#b5f314] font-black uppercase tracking-widest">
                Местное время выбранного пояса
              </span>
              <div className="text-4xl font-black font-mono leading-none tracking-wider text-[#b5f314]">
                {liveTime || "—"}
              </div>
              <span className="text-[10px] text-zinc-400 font-bold block">
                {timezones.find((t) => t.id === timezone)?.name || timezone}
              </span>
            </div>

            {/* Selection list */}
            <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
              {timezones.map((tz) => (
                <button
                  key={tz.id}
                  onClick={() => setTimezone(tz.id)}
                  className={`w-full p-4.5 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer active:scale-99 ${
                    timezone === tz.id
                      ? "bg-[#e30613]/5 dark:bg-[#e30613]/10 border-[#e30613]/35 text-[#e30613] shadow-xs"
                      : "bg-white dark:bg-[#161b22] border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/20"
                  }`}
                >
                  <div>
                    <span className="text-xs font-extrabold block">{tz.name}</span>
                    <span className="text-[10px] text-zinc-400 font-semibold block mt-0.5">
                      {tz.city}
                    </span>
                  </div>
                  <Globe className={`w-4 h-4 ${timezone === tz.id ? "text-[#e30613]" : "text-zinc-400"}`} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. DEVELOPER MODE SUB-SCREEN */}
        {activeSubScreen === "dev" && (
          <div className={`animate-fade-in ${isMobile ? "space-y-4" : "flex gap-6 items-start min-h-[550px]"}`}>
            {/* If Mobile, top tab swapper. If Desktop, left menu sidebar */}
            {isMobile ? (
              <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-xl gap-0.5 border border-zinc-200/40 dark:border-zinc-800/60 overflow-x-auto select-none">
                <button
                  onClick={() => setDevTab("diagnostics")}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap px-3 text-center ${
                    devTab === "diagnostics"
                      ? "bg-white dark:bg-zinc-750 text-[#e30613] shadow-xs"
                      : "text-zinc-650 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  Диагностика
                </button>
                <button
                  onClick={() => setDevTab("integrations")}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap px-3 text-center ${
                    devTab === "integrations"
                      ? "bg-white dark:bg-zinc-750 text-[#e30613] shadow-xs"
                      : "text-zinc-650 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  Интеграции Алиса
                </button>
                <button
                  onClick={() => setDevTab("inspector")}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap px-3 text-center ${
                    devTab === "inspector"
                      ? "bg-white dark:bg-zinc-750 text-[#e30613] shadow-xs"
                      : "text-zinc-650 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  Инспектор SDK
                </button>
              </div>
            ) : (
              /* Desktop: Beautiful Left Side Navigation Panel */
              <div className="w-[200px] shrink-0 space-y-4 bg-zinc-100/60 dark:bg-zinc-900/40 border border-zinc-200/40 dark:border-zinc-800/60 p-4 rounded-2xl flex flex-col justify-between self-stretch">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-zinc-450 uppercase tracking-widest block mb-2.5 px-1 leading-none">
                    Меню отладки
                  </span>
                  <button
                    onClick={() => setDevTab("diagnostics")}
                    className={`w-full text-left py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      devTab === "diagnostics"
                        ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 shrink-0" />
                    <span>Диагностика</span>
                  </button>
                  <button
                    onClick={() => setDevTab("integrations")}
                    className={`w-full text-left py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      devTab === "integrations"
                        ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    }`}
                  >
                    <Blocks className="w-3.5 h-3.5 shrink-0" />
                    <span>Интеграции</span>
                  </button>
                  <button
                    onClick={() => setDevTab("inspector")}
                    className={`w-full text-left py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      devTab === "inspector"
                        ? "bg-white dark:bg-zinc-800 text-[#e30613] shadow-xs border border-zinc-200/50 dark:border-zinc-700/50"
                        : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                    }`}
                  >
                    <FolderCode className="w-3.5 h-3.5 shrink-0" />
                    <span>Инспектор SDK</span>
                  </button>
                </div>

                {/* Tech specifications tag */}
                <div className="pt-4 border-t border-zinc-200/40 dark:border-zinc-800/60 font-mono text-[9px] text-zinc-400 space-y-2 leading-tight">
                  <div>
                    <span className="block font-black uppercase text-[8px] text-zinc-500">Версия SDK</span>
                    <span className="text-zinc-800 dark:text-zinc-300">domru-js @2.0.1</span>
                  </div>
                  <div>
                    <span className="block font-black uppercase text-[8px] text-zinc-500">Запросы</span>
                    <span className="text-zinc-800 dark:text-zinc-300 font-sans">JSON/WebRTC</span>
                  </div>
                </div>
              </div>
            )}

            {/* Active Sub-tab Content Panel */}
            <div className={`flex-1 ${isMobile ? "" : "h-full overflow-y-auto pr-1"}`}>
              {devTab === "diagnostics" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl space-y-4 shadow-xs">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xs font-extrabold text-zinc-800 dark:text-white block">
                          Режим разработчика
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold block leading-normal">
                          Включает технические логи, средства диагностики и дополнительные настройки под видео-трансляцией.
                        </span>
                      </div>
                      
                      {/* Custom Toggle Switch */}
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
                  </div>

                  {isDevModeEnabled && (
                    <div className="p-4 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl space-y-4 shadow-xs animate-fade-in">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-xs font-extrabold text-zinc-800 dark:text-white block">
                            Использовать WebRTC (UDP)
                          </span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold block leading-normal">
                            Трансляция без задержек. Использование UDP может привести к блокировке IP-адреса строгими брандмауэрами или Anti-DDoS защитой на стороне хостинга.
                          </span>
                        </div>
                        
                        {/* WebRTC Toggle Switch */}
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
                    </div>
                  )}

                  {/* Diagnostics system table */}
                  <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800/50 shadow-xs">
                    <div className="p-3 px-4 flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-500 dark:text-zinc-400">Модель SDK</span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">domru-js v2.0.1</span>
                    </div>
                    <div className="p-3 px-4 flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-500 dark:text-zinc-400">Прокси-урл</span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">/api/domru-proxy</span>
                    </div>
                    <div className="p-3 px-4 flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-500 dark:text-zinc-400">Формат потока</span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">{useWebRTC ? "WebRTC" : "HLS"}</span>
                    </div>
                    <div className="p-3 px-4 flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-500 dark:text-zinc-400">Ping до камер</span>
                      <span className="font-mono text-emerald-500 font-black">~18 ms</span>
                    </div>
                    <div className="p-3 px-4 flex items-center justify-between text-xs font-semibold">
                      <span className="text-zinc-500 dark:text-zinc-400">Устройство</span>
                      <span className="font-mono text-zinc-800 dark:text-zinc-200 font-black">{isMobile ? "Mobile Client UI" : "Desktop Dashboard UI"}</span>
                    </div>
                  </div>
                </div>
              )}

              {devTab === "integrations" && (
                <div className={`animate-fade-in ${isMobile ? "max-h-[60vh]" : "max-h-[75vh]"} overflow-y-auto pr-1`}>
                  <Integrations credentials={credentials || { login: "demo", isDemo: true }} />
                </div>
              )}

              {devTab === "inspector" && (
                <div className={`animate-fade-in ${isMobile ? "max-h-[60vh]" : "max-h-[75vh]"} overflow-y-auto pr-1`}>
                  <CodeBrowser />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- MAIN SCREEN LAYOUT ---
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

        {/* Options list inside main Cabinet panel */}
        <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-[2rem] shadow-lg overflow-hidden divide-y divide-zinc-150 dark:divide-zinc-800/50">
          {/* My Keys */}
          <div
            onClick={() => setActiveSubScreen("keys")}
            className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition"
          >
            <div className="flex items-center gap-3">
              <KeyRound className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>Мои ключи</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-semibold text-zinc-450">{keysList.filter(k => k.active).length} акт.</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Theme Settings */}
          <div
            onClick={() => setActiveSubScreen("theme")}
            className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition"
          >
            <div className="flex items-center gap-3">
              {theme === "light" ? (
                <Sun className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              ) : theme === "dark" ? (
                <Moon className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              ) : (
                <Monitor className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              )}
              <span>Тема оформления</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-semibold text-zinc-450 uppercase">
                {theme === "light" && "Светлая"}
                {theme === "dark" && "Тёмная"}
                {theme === "system" && "Системная"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Timezone Settings */}
          <div
            onClick={() => setActiveSubScreen("timezone")}
            className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>Часовой пояс (Время)</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-semibold text-zinc-450 truncate max-w-[120px]">
                {timezones.find((t) => t.id === timezone)?.name.split(" ")[0] || timezone}
              </span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Developer Mode */}
          <div
            onClick={() => setActiveSubScreen("dev")}
            className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition"
          >
            <div className="flex items-center gap-3">
              <Cpu className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>Режим разработчика</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-semibold text-zinc-450">
                {isDevModeEnabled ? "Включен" : "Выключен"}
              </span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Notifications */}
          <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
            <div className="flex items-center gap-3">
              <Bell className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>Уведомления</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
          </div>

          {/* App Info */}
          <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition">
            <div className="flex items-center gap-3">
              <Clock className="w-4.5 h-4.5 text-[#e30613] dark:text-zinc-400" />
              <span>О приложении</span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
              <span className="text-[10px] font-semibold text-zinc-450">v1.2.4</span>
              <ChevronRight className="w-4 h-4" />
            </div>
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

  // --- DESKTOP SCREEN LAYOUT ---
  return (
    <div className="space-y-6 animate-fade-in text-zinc-900 dark:text-white">
      {/* Account Info Badge */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] shadow-md space-y-5">
        <div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block leading-none">
            Договор {selectedPlace?.accountId || "—"}
          </span>
          <div className="flex items-center gap-2 mt-1.5 leading-none">
            <h3 className="font-extrabold text-base">
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
        {/* My Keys */}
        <div
          onClick={() => setActiveSubScreen("keys")}
          className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition"
        >
          <div className="flex items-center gap-3">
            <KeyRound className="w-4.5 h-4.5 text-[#E30613]" />
            <span>Мои ключи</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] font-semibold text-zinc-400">{keysList.filter(k => k.active).length} акт.</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Theme Settings */}
        <div
          onClick={() => setActiveSubScreen("theme")}
          className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition"
        >
          <div className="flex items-center gap-3">
            {theme === "light" ? (
              <Sun className="w-4.5 h-4.5 text-[#E30613]" />
            ) : theme === "dark" ? (
              <Moon className="w-4.5 h-4.5 text-[#E30613]" />
            ) : (
              <Monitor className="w-4.5 h-4.5 text-[#E30613]" />
            )}
            <span>Тема оформления</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] font-semibold uppercase text-zinc-400">
              {theme === "light" && "Светлая"}
              {theme === "dark" && "Тёмная"}
              {theme === "system" && "Системная"}
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Timezone Settings */}
        <div
          onClick={() => setActiveSubScreen("timezone")}
          className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition"
        >
          <div className="flex items-center gap-3">
            <Globe className="w-4.5 h-4.5 text-[#E30613]" />
            <span>Часовой пояс (Время)</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] font-semibold text-zinc-400">
              {timezones.find((t) => t.id === timezone)?.name.split(" ")[0] || timezone}
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Developer Mode */}
        <div
          onClick={() => setActiveSubScreen("dev")}
          className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition"
        >
          <div className="flex items-center gap-3">
            <Cpu className="w-4.5 h-4.5 text-[#E30613]" />
            <span>Режим разработчика</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
            <span className="text-[10px] font-semibold text-zinc-400">
              {isDevModeEnabled ? "Включен" : "Выключен"}
            </span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>

        {/* Notifications */}
        <div className="p-4.5 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/25 transition">
          <div className="flex items-center gap-3">
            <Bell className="w-4.5 h-4.5 text-[#E30613]" />
            <span>Уведомления</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>

        {/* App Info */}
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
