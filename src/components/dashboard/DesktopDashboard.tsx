import React from "react";
import { SmartPlace, SmartDevice, SmartCamera, GuestPin, HistoryEvent, AppCredentials } from "../../types";
import { Home, Bell, Users, Sliders, RefreshCw, Car } from "lucide-react";
import MyHomeView from "./MyHomeView";
import EventsView from "./EventsView";
import PeopleView from "./PeopleView";
import CabinetView from "./CabinetView";
import CctvPlayer from "./CctvPlayer";

interface DesktopDashboardProps {
  activeTab: "myhome" | "events" | "people" | "cabinet";
  setActiveTab: (tab: "myhome" | "events" | "people" | "cabinet") => void;
  places: SmartPlace[];
  selectedPlace: SmartPlace | null;
  setSelectedPlace: (p: SmartPlace) => void;
  devices: SmartDevice[];
  cameras: SmartCamera[];
  credentials: AppCredentials;
  snapshotTime: number;
  playerMode: "stream" | "snapshot";
  setPlayerMode: (mode: "stream" | "snapshot") => void;
  hasStreamError: boolean;
  setHasStreamError: (val: boolean) => void;
  forceHlsJS: boolean;
  setForceHlsJS: (val: boolean) => void;
  streamUrl: string | null;
  streamType: string | null;
  loadingStream: boolean;
  streamLogs: string[];
  setStreamLogs: React.Dispatch<React.SetStateAction<string[]>>;
  addStreamLog: (msg: string) => void;
  activeCamera: string | null;
  setActiveCamera: (cam: string | null) => void;
  setStreamUrl: (url: string | null) => void;
  openingDoorId: number | null;
  triggerOpenDoor: (id: number) => void;
  doorMessage: string | null;
  pins: GuestPin[];
  makeGuestPin: () => void;
  groupedEvents: Record<string, HistoryEvent[]>;
  onLogout: () => void;
  loadData: () => void;
  isCabinetOpen: boolean;
  setIsCabinetOpen: (open: boolean) => void;
  isDevModeEnabled: boolean;
  setIsDevModeEnabled: (enabled: boolean) => void;
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  timezone: string;
  setTimezone: (tz: string) => void;
}

export default function DesktopDashboard({
  activeTab,
  setActiveTab,
  places,
  selectedPlace,
  setSelectedPlace,
  devices,
  cameras,
  credentials,
  snapshotTime,
  playerMode,
  setPlayerMode,
  hasStreamError,
  setHasStreamError,
  forceHlsJS,
  setForceHlsJS,
  streamUrl,
  streamType,
  loadingStream,
  streamLogs,
  setStreamLogs,
  addStreamLog,
  activeCamera,
  setActiveCamera,
  setStreamUrl,
  openingDoorId,
  triggerOpenDoor,
  doorMessage,
  pins,
  makeGuestPin,
  groupedEvents,
  onLogout,
  loadData,
  isCabinetOpen,
  setIsCabinetOpen,
  isDevModeEnabled,
  setIsDevModeEnabled,
  theme,
  setTheme,
  timezone,
  setTimezone,
}: DesktopDashboardProps) {
  const [activeSubScreen, setActiveSubScreen] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isCabinetOpen) {
      setActiveSubScreen(null);
    }
  }, [isCabinetOpen]);

  return (
    <div className="space-y-6" id="desktop_dashboard">
      {/* Top Address & Action Bar */}
      <div className="flex flex-row items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-3xl shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-full text-zinc-500 dark:text-zinc-400">
            <Car className="w-5 h-5" />
          </div>
          <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800/80 rounded-full px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition">
            <select
              value={selectedPlace?.id || ""}
              onChange={(e) => {
                const f = places.find((p) => p.id === Number(e.target.value));
                if (f) setSelectedPlace(f);
              }}
              className="bg-transparent text-zinc-800 dark:text-white text-xs font-bold focus:outline-none cursor-pointer pr-6 appearance-none border-none py-0.5 leading-tight font-sans"
            >
              {places.map((p, idx) => (
                <option
                  key={`${p.id}-${p.accountId || idx}-${idx}`}
                  value={p.id}
                  className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-white font-semibold"
                >
                  {p.visibleAddress}
                </option>
              ))}
            </select>
            <div className="absolute right-4 pointer-events-none text-[8px] text-zinc-400 dark:text-zinc-500 font-black">
              ▼
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {credentials.isDemo && (
            <span className="px-3 py-1.5 text-[10px] bg-[#E30613]/10 text-[#E30613] font-bold rounded-full border border-[#E30613]/25 mr-2">
              Режим симуляции (Demo)
            </span>
          )}
          <button
            onClick={loadData}
            className="p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition shadow-2xs cursor-pointer"
            title="Обновить данные"
            id="global_refresh_btn"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar (Centered) */}
      <div className="grid grid-cols-3 gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 p-1 rounded-2xl shadow-lg max-w-xl mx-auto">
        <button
          onClick={() => setActiveTab("myhome")}
          className={`py-3 text-[11px] font-extrabold rounded-xl flex flex-row items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === "myhome"
              ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/20"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Мой дом</span>
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`py-3 text-[11px] font-extrabold rounded-xl flex flex-row items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === "events"
              ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/20"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>События</span>
        </button>
        <button
          onClick={() => setActiveTab("people")}
          className={`py-3 text-[11px] font-extrabold rounded-xl flex flex-row items-center justify-center gap-1.5 transition-all duration-200 cursor-pointer ${
            activeTab === "people"
              ? "bg-[#E30613] text-white shadow-md shadow-[#E30613]/20"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Люди</span>
        </button>
      </div>

      {/* Main Split Grid (If Camera active, split CCTV and Tab content side-by-side) */}
      {activeCamera ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Column 1: Video stream player */}
          <div className="lg:col-span-7">
            <CctvPlayer
              activeCamera={activeCamera}
              devices={devices}
              cameras={cameras}
              credentials={credentials}
              snapshotTime={snapshotTime}
              playerMode={playerMode}
              setPlayerMode={setPlayerMode}
              hasStreamError={hasStreamError}
              setHasStreamError={setHasStreamError}
              forceHlsJS={forceHlsJS}
              setForceHlsJS={setForceHlsJS}
              streamUrl={streamUrl}
              streamType={streamType}
              loadingStream={loadingStream}
              streamLogs={streamLogs}
              setStreamLogs={setStreamLogs}
              addStreamLog={addStreamLog}
              isDevModeEnabled={isDevModeEnabled}
              onClose={() => {
                setActiveCamera(null);
                setStreamUrl(null);
              }}
              selectedPlaceId={selectedPlace?.id}
              openingDoorId={openingDoorId}
              triggerOpenDoor={triggerOpenDoor}
            />
          </div>

          {/* Column 2: Dashboard Content side-by-side */}
          <div className="lg:col-span-5">
            {activeTab === "myhome" && (
              <MyHomeView
                devices={devices}
                setActiveCamera={setActiveCamera}
                doorMessage={doorMessage}
                selectedPlaceId={selectedPlace?.id}
                credentials={credentials}
                isCompactMode={true}
                openingDoorId={openingDoorId}
                triggerOpenDoor={triggerOpenDoor}
              />
            )}
            {activeTab === "events" && <EventsView groupedEvents={groupedEvents} />}
            {activeTab === "people" && <PeopleView pins={pins} makeGuestPin={makeGuestPin} />}
          </div>
        </div>
      ) : (
        /* Normal Centered Single Column view when no camera active */
        <div className="max-w-4xl mx-auto w-full">
          {activeTab === "myhome" && (
            <MyHomeView
              devices={devices}
              setActiveCamera={setActiveCamera}
              doorMessage={doorMessage}
              selectedPlaceId={selectedPlace?.id}
              credentials={credentials}
              isCompactMode={false}
              openingDoorId={openingDoorId}
              triggerOpenDoor={triggerOpenDoor}
            />
          )}
          {activeTab === "events" && <EventsView groupedEvents={groupedEvents} />}
          {activeTab === "people" && <PeopleView pins={pins} makeGuestPin={makeGuestPin} />}
        </div>
      )}

      {/* Cabinet Drawer Overlay (Option B: Slide-out Panel) */}
      {isCabinetOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 dark:bg-black/65 backdrop-blur-xs flex justify-end animate-fade-in">
          {/* Backdrop closer */}
          <div 
            className="absolute inset-0 cursor-pointer" 
            onClick={() => setIsCabinetOpen(false)}
          />
          
          {/* Drawer Body with dynamic width transition */}
          <div 
            className={`relative h-full bg-zinc-50 dark:bg-[#101418] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col z-10 transition-all duration-300 ease-in-out animate-slide-in-right ${
              activeSubScreen === "dev"
                ? "w-full md:w-[750px] lg:w-[950px] xl:w-[1100px]"
                : "w-full md:w-[480px]"
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 bg-white dark:bg-[#101418] border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div>
                <h3 className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">Личный кабинет</h3>
                {activeSubScreen === "dev" && (
                  <p className="text-[10px] font-black text-[#e30613] uppercase tracking-wider mt-0.5 animate-fade-in">
                    Инструменты разработчика
                  </p>
                )}
              </div>
              <button 
                onClick={() => setIsCabinetOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-white rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6" id="cabinet_drawer_scrollable">
              <CabinetView 
                selectedPlace={selectedPlace} 
                onLogout={onLogout} 
                theme={theme}
                setTheme={setTheme}
                isDevModeEnabled={isDevModeEnabled}
                setIsDevModeEnabled={setIsDevModeEnabled}
                timezone={timezone}
                setTimezone={setTimezone}
                credentials={credentials}
                onSubScreenChange={setActiveSubScreen}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
