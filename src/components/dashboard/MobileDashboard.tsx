import React from "react";
import { SmartPlace, SmartDevice, SmartCamera, GuestPin, HistoryEvent, AppCredentials } from "../../types";
import { Home, Bell, Users, Sliders, RefreshCw, Car } from "lucide-react";
import MyHomeView from "./MyHomeView";
import EventsView from "./EventsView";
import PeopleView from "./PeopleView";
import CabinetView from "./CabinetView";
import CctvPlayer from "./CctvPlayer";

interface MobileDashboardProps {
  activeTab: "myhome" | "events" | "people";
  setActiveTab: (tab: "myhome" | "events" | "people") => void;
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
}

export default function MobileDashboard({
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
}: MobileDashboardProps) {
  return (
    <div className="flex flex-col space-y-6 pb-24" id="mobile_dashboard">
      {/* Top Address & Action Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full text-zinc-500 dark:text-zinc-400">
            <Car className="w-4 h-4" />
          </div>
          <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800/80 rounded-full px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition">
            <select
              value={selectedPlace?.id || ""}
              onChange={(e) => {
                const f = places.find((p) => p.id === Number(e.target.value));
                if (f) setSelectedPlace(f);
              }}
              className="bg-transparent text-zinc-800 dark:text-white text-xs font-bold focus:outline-none cursor-pointer pr-5 appearance-none border-none py-0.5 leading-tight font-sans"
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
            <div className="absolute right-3.5 pointer-events-none text-[7px] text-zinc-400 dark:text-zinc-500 font-black">
              ▼
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {credentials.isDemo && (
            <span className="px-2 py-1 text-[9px] bg-[#E30613]/10 text-[#E30613] font-bold rounded-full border border-[#E30613]/20">
              Demo
            </span>
          )}
          <button
            onClick={loadData}
            className="p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 transition cursor-pointer"
            title="Обновить"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CCTV video player container (Mobile inline top display when active) */}
      {activeCamera && (
        <div className="animate-fade-in">
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
            onClose={() => {
              setActiveCamera(null);
              setStreamUrl(null);
            }}
            selectedPlaceId={selectedPlace?.id}
            openingDoorId={openingDoorId}
            triggerOpenDoor={triggerOpenDoor}
          />
        </div>
      )}

      {/* Content Rendering based on Tab */}
      <div className="flex-1">
        {activeTab === "myhome" && (
          <MyHomeView
            devices={devices}
            setActiveCamera={setActiveCamera}
            doorMessage={doorMessage}
            selectedPlaceId={selectedPlace?.id}
            credentials={credentials}
          />
        )}
        {activeTab === "events" && <EventsView groupedEvents={groupedEvents} />}
        {activeTab === "people" && <PeopleView pins={pins} makeGuestPin={makeGuestPin} />}
      </div>

      {isCabinetOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#101418] w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl relative animate-slide-up">
            <div className="sticky top-0 bg-white/80 dark:bg-[#101418]/80 backdrop-blur-md z-10 flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-extrabold text-lg">Личный кабинет</h3>
              <button 
                onClick={() => setIsCabinetOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-2">
              <CabinetView selectedPlace={selectedPlace} onLogout={onLogout} />
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#101418] border-t border-zinc-200 dark:border-zinc-800/80 p-2 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.08)] dark:shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.3)]">
        <div className="grid grid-cols-3 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab("myhome")}
            className={`py-1.5 text-[10px] font-bold rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTab === "myhome"
                ? "text-[#E30613]"
                : "text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <Home className="w-5 h-5" />
            <span>Мой дом</span>
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`py-1.5 text-[10px] font-bold rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTab === "events"
                ? "text-[#E30613]"
                : "text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <Bell className="w-5 h-5" />
            <span>События</span>
          </button>
          <button
            onClick={() => setActiveTab("people")}
            className={`py-1.5 text-[10px] font-bold rounded-xl flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              activeTab === "people"
                ? "text-[#E30613]"
                : "text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <Users className="w-5 h-5" />
            <span>Люди</span>
          </button>
        </div>
      </div>
    </div>
  );
}
