import { useState, useEffect } from "react";
import { AppCredentials } from "./types";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import { Database, Home, Sun, Moon, Monitor } from "lucide-react";

export default function App() {
  const [credentials, setCredentials] = useState<AppCredentials | null>(() => {
    const saved = localStorage.getItem("domru_credentials");
    if (saved) {
      try {
        const creds = JSON.parse(saved);
        // Ensure cookie is set
        const authPayload = btoa(encodeURIComponent(JSON.stringify({
          token: creds.token,
          refreshToken: creds.refreshToken,
          operatorId: creds.operatorId
        })));
        document.cookie = `domru_auth=${authPayload}; path=/; max-age=31536000; secure; samesite=strict`;
        return creds;
      } catch (e) {
        console.error("Failed to parse saved credentials", e);
      }
    }
    return null;
  });
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    const saved = localStorage.getItem("theme");
    return (saved as "light" | "dark" | "system") || "system";
  });
  const [isDevModeEnabled, setIsDevModeEnabled] = useState<boolean>(() => {
    return localStorage.getItem("is_dev_mode_enabled") === "true";
  });
  const [useWebRTC, setUseWebRTC] = useState<boolean>(() => {
    return localStorage.getItem("is_webrtc_enabled") === "true";
  });
  const [timezone, setTimezoneState] = useState<string>("Europe/Moscow");

  useEffect(() => {
    fetch("/api/settings")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new TypeError("Received non-JSON response from server");
        }
        return res.json();
      })
      .then(data => {
        if (data && data.timezone) {
          setTimezoneState(data.timezone);
        }
      })
      .catch(err => console.error("Failed to load global timezone settings:", err));
  }, []);

  const setTimezone = (tz: string) => {
    setTimezoneState(tz);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz })
    }).catch(err => console.error("Failed to save global timezone settings:", err));
  };

  useEffect(() => {
    localStorage.setItem("is_dev_mode_enabled", String(isDevModeEnabled));
  }, [isDevModeEnabled]);

  useEffect(() => {
    localStorage.setItem("is_webrtc_enabled", String(useWebRTC));
  }, [useWebRTC]);


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
    
    // Set cookie for standard <img> tag auth
    const authPayload = btoa(encodeURIComponent(JSON.stringify({
      token: creds.token,
      refreshToken: creds.refreshToken,
      operatorId: creds.operatorId
    })));
    document.cookie = `domru_auth=${authPayload}; path=/; max-age=31536000; secure; samesite=strict`;
  };

  const handleLogout = () => {
    setCredentials(null);
    localStorage.removeItem("domru_credentials");
    document.cookie = `domru_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0B0F12] text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300" id="app_root">
      {credentials === null ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 relative bg-zinc-100 dark:bg-[#0B0F12] transition-colors duration-300">
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
          <div className="w-full max-w-md flex flex-col items-center">
            <LoginForm onLoginSuccess={handleLoginSuccess} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col min-h-screen">
          {/* Header Bar */}
          <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30 shadow-xs" id="main_header">
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
                </div>
              </div>
            </div>
          </header>

          {/* Main User Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in" id="main_content">
            <Dashboard 
              credentials={credentials} 
              onLogout={handleLogout} 
              isDevModeEnabled={isDevModeEnabled}
              setIsDevModeEnabled={setIsDevModeEnabled}
              useWebRTC={useWebRTC}
              setUseWebRTC={setUseWebRTC}
              theme={theme}
              setTheme={setTheme}
              timezone={timezone}
              setTimezone={setTimezone}
            />
          </main>

          {/* Micro Footer */}
          <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 py-4 text-center text-xs text-zinc-400 font-mono">
            <span>дом.ru умный дом • клиентская панель управления</span>
          </footer>
        </div>
      )}
    </div>
  );
}
