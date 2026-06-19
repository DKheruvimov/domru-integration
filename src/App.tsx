import { useState, useEffect } from "react";
import { AppCredentials } from "./types";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import CodeBrowser from "./components/CodeBrowser";
import Integrations from "./components/Integrations";
import { Cpu, Terminal, LayoutDashboard, Database, ExternalLink, Sun, Moon, Monitor, Layers } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"dashboard" | "code" | "integrations">("dashboard");
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
                  ? "bg-white dark:bg-zinc-800 text-amber-500 shadow-sm"
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
              {/* Desktop layout: hidden on mobile/tablet */}
              <div className="hidden lg:flex justify-between h-16 items-center">
                {/* Brand / Logo */}
                <div className="flex items-center gap-2.5">
                  <div className="bg-[#E30613] w-9 h-9 rounded-xl flex items-center justify-center shadow-md transform hover:scale-105 transition-transform duration-300">
                    <div className="w-4 h-4 border-2 border-white rounded-xs"></div>
                  </div>
                  <div>
                    <span className="font-display font-semibold text-sm tracking-tight text-zinc-950 dark:text-white">
                      Dom.ru Proptech
                    </span>
                    <span className="text-[10px] font-mono text-[#E30613] dark:text-red-400 font-semibold block uppercase tracking-wider">
                      Client Dashboard v2.4.0
                    </span>
                  </div>
                </div>

                {/* Center Tabs */}
                <div className="flex space-x-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl animate-fade-in" id="tab_control_container">
                  <button
                    onClick={() => setActiveTab("dashboard")}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all duration-300 ${
                      activeTab === "dashboard"
                        ? "bg-white dark:bg-zinc-700 text-[#E30613] dark:text-red-400 shadow-sm"
                        : "text-zinc-650 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-250"
                    }`}
                    id="tab_dashboard_btn"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    Панель управления
                  </button>
                  <button
                    onClick={() => setActiveTab("integrations")}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all duration-300 ${
                      activeTab === "integrations"
                        ? "bg-white dark:bg-zinc-700 text-[#E30613] dark:text-red-400 shadow-sm"
                        : "text-zinc-650 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-250"
                    }`}
                    id="tab_integrations_btn"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Интеграции
                  </button>
                  <button
                    onClick={() => setActiveTab("code")}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all duration-300 ${
                      activeTab === "code"
                        ? "bg-white dark:bg-zinc-700 text-[#E30613] dark:text-red-400 shadow-sm"
                        : "text-zinc-650 hover:text-zinc-955 dark:text-zinc-400 dark:hover:text-zinc-250"
                    }`}
                    id="tab_code_btn"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Инспектор кода библиотеки
                  </button>
                </div>

                {/* Right Badge */}
                <div className="flex items-center gap-3">
                  <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-805 font-mono text-xs rounded-xl text-zinc-500 shadow-2xs">
                    <Database className="w-3.5 h-3.5 text-[#E30613] animate-pulse" />
                    <span>
                      {credentials.isDemo
                        ? "Sandbox Mode"
                        : `Operator: ${credentials.operatorId || "Active"}`}
                    </span>
                  </div>

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
                          ? "bg-white dark:bg-zinc-700 text-red-500 shadow-xs"
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

                  <a
                    href="https://github.com/S0yora/domru-js"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-lg transition-colors"
                    title="Open Original GitHub Repo"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Mobile layout: clean stacked structure */}
              <div className="flex lg:hidden flex-col py-3 gap-2">
                {/* Top row: Logo on left, switcher and github on right */}
                <div className="flex justify-between items-center pb-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-[#E30613] w-8 h-8 rounded-lg flex items-center justify-center shadow-md">
                      <div className="w-3.1 h-3.1 border-2 border-white rounded-xs"></div>
                    </div>
                    <div>
                      <span className="font-display font-bold text-xs text-zinc-950 dark:text-white block">
                        Dom.ru Proptech
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Header Theme Switcher compact */}
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                      <button
                        onClick={() => setTheme("light")}
                        className={`p-1 rounded-md transition-all ${
                          theme === "light"
                            ? "bg-white dark:bg-zinc-700 text-amber-550 shadow-xs"
                            : "text-zinc-400"
                        }`}
                        title="Светлая"
                      >
                        <Sun className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setTheme("dark")}
                        className={`p-1 rounded-md transition-all ${
                          theme === "dark"
                            ? "bg-white dark:bg-[#18181B] text-red-500 shadow-xs"
                            : "text-zinc-400"
                        }`}
                        title="Темная"
                      >
                        <Moon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setTheme("system")}
                        className={`p-1 rounded-md transition-all ${
                          theme === "system"
                            ? "bg-white dark:bg-zinc-700 text-purple-400 shadow-xs"
                            : "text-zinc-400"
                        }`}
                        title="Авто"
                      >
                        <Monitor className="w-3 h-3" />
                      </button>
                    </div>

                    <a
                      href="https://github.com/S0yora/domru-js"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 rounded-md"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Bottom row: Scrollable navigation pills */}
                <div className="pt-2 overflow-x-auto scrollbar-none -mx-4 px-4 flex gap-1.5 items-center whitespace-nowrap">
                  <button
                    onClick={() => setActiveTab("dashboard")}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all shrink-0 ${
                      activeTab === "dashboard"
                        ? "bg-[#E30613]/10 text-[#E30613] dark:bg-[#E30613]/20 dark:text-red-400"
                        : "bg-zinc-100 text-zinc-500 hover:text-zinc-900 dark:bg-zinc-800/40 dark:text-zinc-400"
                    }`}
                  >
                    <LayoutDashboard className="w-3 h-3" />
                    Панель управления
                  </button>
                  <button
                    onClick={() => setActiveTab("integrations")}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all shrink-0 ${
                      activeTab === "integrations"
                        ? "bg-[#E30613]/10 text-[#E30613] dark:bg-[#E30613]/20 dark:text-red-400"
                        : "bg-zinc-100 text-zinc-500 hover:text-zinc-900 dark:bg-zinc-800/40 dark:text-zinc-400"
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    Интеграции
                  </button>
                  <button
                    onClick={() => setActiveTab("code")}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all shrink-0 ${
                      activeTab === "code"
                        ? "bg-[#E30613]/10 text-[#E30613] dark:bg-[#E30613]/20 dark:text-red-400"
                        : "bg-zinc-100 text-zinc-500 hover:text-zinc-900 dark:bg-zinc-800/40 dark:text-zinc-400"
                    }`}
                  >
                    <Terminal className="w-3 h-3" />
                    Инспектор кода библиотеки
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main_content">
            {activeTab === "dashboard" ? (
              <Dashboard credentials={credentials} onLogout={handleLogout} />
            ) : activeTab === "integrations" ? (
              <Integrations credentials={credentials} />
            ) : (
              <CodeBrowser />
            )}
          </main>

          {/* Micro Footer */}
          <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 text-center text-xs text-zinc-400 font-mono">
            <span>Кастомизировано для интерактивного анализа и модификации • AI Studio Build</span>
          </footer>
        </div>
      )}
    </div>
  );
}
