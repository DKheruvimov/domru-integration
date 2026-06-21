import { useState, useEffect } from "react";
import { AppCredentials } from "./types";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import CodeBrowser from "./components/CodeBrowser";
import Integrations from "./components/Integrations";
import { Cpu, Terminal, LayoutDashboard, Database, ExternalLink, Sun, Moon, Monitor, Layers, X, Code, Home } from "lucide-react";

export default function App() {
  const [credentials, setCredentials] = useState<AppCredentials | null>(() => {
    const saved = localStorage.getItem("domru_credentials");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved credentials", e);
      }
    }
    return null;
  });
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [devTab, setDevTab] = useState<"integrations" | "code">("integrations");
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    const saved = localStorage.getItem("theme");
    return (saved as "light" | "dark" | "system") || "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (currentTheme: "light" | "dark" | "system") => {
      root.classList.remove("dark");
      if (currentTheme === "dark") {
        root.classList.add("dark");
      } else if (currentTheme === "system") {
        const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (isSystemDark) {
          root.classList.add("dark");
        }
      }
    };

    applyTheme(theme);
    localStorage.setItem("theme", theme);

    if (theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = (e: MediaQueryListEvent) => {
        root.classList.remove("dark");
        if (e.matches) {
          root.classList.add("dark");
        }
      };
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
  }, [theme]);

  const handleLoginSuccess = (creds: AppCredentials) => {
    setCredentials(creds);
    localStorage.setItem("domru_credentials", JSON.stringify(creds));
  };

  const handleLogout = () => {
    setCredentials(null);
    localStorage.removeItem("domru_credentials");
    setShowDevPanel(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300" id="app_root">
      {credentials === null ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 relative bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
          {/* Floating Theme Switcher on Login View */}
          <div className="absolute top-6 right-6 flex items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-zinc-200/50 dark:border-zinc-800" id="floating_theme_selector">
            <button
              onClick={() => setTheme("light")}
              className={`p-2 rounded-xl transition-all ${
                theme === "light"
                  ? "bg-white dark:bg-zinc-800 text-[#E30613] shadow-sm"
                  : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
              title="Светлая тема"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={`p-2 rounded-xl transition-all ${
                theme === "dark"
                  ? "bg-white dark:bg-zinc-800 text-teal-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
              title="Темная тема"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("system")}
              className={`p-2 rounded-xl transition-all ${
                theme === "system"
                  ? "bg-white dark:bg-zinc-800 text-purple-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
              title="Системная тема"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </div>
      ) : (
        <div className="flex flex-col min-h-screen">
          {/* Header Bar */}
          <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-805 sticky top-0 z-30 shadow-xs" id="main_header">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16 items-center">
                {/* Brand / Logo (Dom.ru style) */}
                <div className="flex items-center gap-2">
                  <div className="bg-[#E30613] w-8 h-8 rounded-xl flex items-center justify-center shadow-md transform hover:rotate-6 transition-transform duration-300">
                    <Home className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-black text-xl tracking-tighter text-zinc-950 dark:text-white flex items-center gap-1">
                      дом
                      <span className="bg-[#E30613] text-white text-[11px] font-black px-1.5 py-0.5 rounded-full inline-flex items-center justify-center min-w-[22px] h-5 shadow-xs">
                        ru
                      </span>
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-extrabold uppercase tracking-wider pl-2 border-l border-zinc-200 dark:border-zinc-800 ml-1">
                      Умный Дом
                    </span>
                  </div>
                </div>

                {/* Header Controls */}
                <div className="flex items-center gap-3">
                  {/* Status Badge */}
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-55 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-805 font-mono text-xs rounded-xl text-zinc-500 shadow-2xs">
                    <Database className="w-3.5 h-3.5 text-[#E30613] animate-pulse" />
                    <span>
                      {credentials.isDemo
                        ? "Песочница"
                        : `Личный кабинет`}
                    </span>
                  </div>

                  {/* Dev Panel Trigger Button */}
                  <button
                    onClick={() => setShowDevPanel(true)}
                    className="px-3.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/85 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer border border-zinc-200/30"
                    id="dev_panel_trigger"
                  >
                    <Code className="w-3.5 h-3.5 text-[#E30613]" />
                    <span className="hidden md:inline">Панель разработчика</span>
                    <span className="md:hidden">Dev</span>
                  </button>

                  {/* Header Theme Switcher Segmented Control */}
                  <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl" id="header_theme_switcher">
                    <button
                      onClick={() => setTheme("light")}
                      className={`p-1.5 rounded-lg transition-all ${
                        theme === "light"
                          ? "bg-white dark:bg-zinc-700 text-amber-500 shadow-xs"
                          : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                      title="Светлая тема"
                    >
                      <Sun className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={`p-1.5 rounded-lg transition-all ${
                        theme === "dark"
                          ? "bg-white dark:bg-zinc-700 text-[#E30613] shadow-xs"
                          : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                      title="Темная тема"
                    >
                      <Moon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className={`p-1.5 rounded-lg transition-all ${
                        theme === "system"
                          ? "bg-white dark:bg-zinc-700 text-purple-400 shadow-xs"
                          : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                      }`}
                      title="Системная тема"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main User Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in" id="main_content">
            <Dashboard credentials={credentials} onLogout={handleLogout} />
          </main>

          {/* Micro Footer */}
          <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 text-center text-xs text-zinc-400 font-mono">
            <span>дом.ru умный дом • клиентская панель управления</span>
          </footer>

          {/* Premium Developer Overlay Modal */}
          {showDevPanel && (
            <div className="fixed inset-0 z-50 flex items-center justify-end animate-fade-in" id="dev_overlay_modal">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs transition-opacity" 
                onClick={() => setShowDevPanel(false)}
              />

              {/* Modal Body / Drawer */}
              <div className="relative w-full max-w-4xl h-full bg-zinc-50 dark:bg-zinc-950 shadow-2xl flex flex-col z-10 border-l border-zinc-200 dark:border-zinc-850 animate-slide-in">
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-805">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-[#E30613] animate-pulse" />
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Панель отладки и интеграции (Dev)</h2>
                  </div>
                  <button 
                    onClick={() => setShowDevPanel(false)}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sub navigation inside drawer */}
                <div className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-2 flex items-center justify-between">
                  <div className="flex bg-zinc-200/50 dark:bg-zinc-800/80 p-0.5 rounded-xl gap-0.5">
                    <button
                      onClick={() => setDevTab("integrations")}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                        devTab === "integrations"
                          ? "bg-white dark:bg-zinc-700 text-[#E30613] shadow-xs"
                          : "text-zinc-650 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Интеграция с Алисой (Яндекс)
                    </button>
                    <button
                      onClick={() => setDevTab("code")}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
                        devTab === "code"
                          ? "bg-white dark:bg-zinc-700 text-[#E30613] shadow-xs"
                          : "text-zinc-650 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-white"
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      Инспектор библиотеки (domru-js)
                    </button>
                  </div>

                  <a
                    href="https://github.com/S0yora/domru-js"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-200 font-mono flex items-center gap-1 hover:underline"
                  >
                    <span>Оригинальный SDK</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Scrollable Modal Content */}
                <div className="flex-1 overflow-y-auto p-6" id="dev_modal_scrollable">
                  {devTab === "integrations" ? (
                    <Integrations credentials={credentials} />
                  ) : (
                    <CodeBrowser />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
