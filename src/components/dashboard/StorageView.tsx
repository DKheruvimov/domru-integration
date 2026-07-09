import { useState, useEffect, useMemo } from "react";
import { Trash2, CheckSquare, Square, RefreshCw, ArchiveX, Camera } from "lucide-react";
import type { StorageSnapshot, AppCredentials } from "../../types";

export default function StorageView({ credentials }: { credentials?: AppCredentials }) {
  const [activeTab, setActiveTab] = useState<"snapshots" | "faceId">("snapshots");
  const [snapshots, setSnapshots] = useState<StorageSnapshot[]>([]);
  const [faceIdKeys, setFaceIdKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<StorageSnapshot | null>(null);
  const [previewFaceId, setPreviewFaceId] = useState<string | null>(null);
  const [peopleNames, setPeopleNames] = useState<Record<string, string>>({});

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const headers: HeadersInit = {};
      if (credentials) {
        headers["x-domru-login"] = credentials.login;
        headers["x-domru-password"] = credentials.password;
        if (credentials.token) headers["x-domru-token"] = credentials.token;
      }
      const res = await fetch(`/api/domru/snapshots/history?login=${encodeURIComponent(credentials?.login || "")}`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setSnapshots(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadFaceIdKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plugins/face-id/storage");
      if (res.ok) {
        const data = await res.json();
        setFaceIdKeys(data.keys || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadPeopleNames = async () => {
    try {
      const headers: HeadersInit = {};
      if (credentials) {
        headers["x-domru-login"] = credentials.login;
        headers["x-domru-password"] = credentials.password;
        if (credentials.token) headers["x-domru-token"] = credentials.token;
      }
      const res = await fetch("/api/domru/people", { headers });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, string> = {};
        data.forEach((p: any) => {
          map[p.id] = p.name;
        });
        setPeopleNames(map);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPeopleNames();
    loadFaceIdKeys();
  }, [credentials]);

  useEffect(() => {
    if (activeTab === "snapshots") {
      loadSnapshots();
    } else {
      loadFaceIdKeys();
    }
    
    const interval = setInterval(() => {
      if (activeTab === "snapshots") loadSnapshots();
      else loadFaceIdKeys();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Reset selection when changing tabs
  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [activeTab]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const targetList = activeTab === "snapshots" ? snapshots.map((s) => s.id) : faceIdKeys;
    if (selectedIds.size === targetList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(targetList));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirm = window.confirm(`Удалить ${selectedIds.size} фото?`);
    if (!confirm) return;

    setDeleting(true);
    try {
      if (activeTab === "snapshots") {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (credentials) {
          headers["x-domru-login"] = credentials.login;
          headers["x-domru-password"] = credentials.password;
          if (credentials.token) headers["x-domru-token"] = credentials.token;
        }

        await fetch(`/api/domru/snapshots/delete?login=${encodeURIComponent(credentials?.login || "")}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        await loadSnapshots();
      } else {
        for (const id of Array.from(selectedIds)) {
          await fetch(`/api/plugins/face-id/image/${id}`, { method: "DELETE" });
        }
        await loadFaceIdKeys();
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (e) {
      console.error("Failed to delete", e);
    } finally {
      setDeleting(false);
    }
  };

  const grouped = useMemo(() => {
    const groups: Record<string, StorageSnapshot[]> = {};
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - today.getDay());

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    snapshots.forEach((s) => {
      const d = new Date(s.timestamp);
      const dStart = new Date(d);
      dStart.setHours(0,0,0,0);

      let key = "Ранее";
      if (dStart.getTime() === today.getTime()) key = "Сегодня";
      else if (dStart.getTime() === yesterday.getTime()) key = "Вчера";
      else if (dStart.getTime() >= weekStart.getTime()) key = "На этой неделе";
      else if (dStart.getTime() >= monthStart.getTime()) key = "В этом месяце";

      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    return groups;
  }, [snapshots]);

  const groupKeys = ["Сегодня", "Вчера", "На этой неделе", "В этом месяце", "Ранее"];

  return (
    <div className="space-y-6 animate-fade-in w-full pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">Хранилище</h2>
          
          <div className="flex bg-zinc-100/50 dark:bg-zinc-800/50 p-1 rounded-xl w-fit border border-zinc-200/50 dark:border-zinc-700/50">
            <button
              onClick={() => setActiveTab("snapshots")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "snapshots"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Снапшоты ({snapshots.length})
            </button>
            <button
              onClick={() => setActiveTab("faceId")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "faceId"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Face ID ({faceIdKeys.length})
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectionMode && (
            <>
              <button 
                onClick={toggleSelectAll}
                className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300"
              >
                {(activeTab === "snapshots" ? selectedIds.size === snapshots.length : selectedIds.size === faceIdKeys.length) ? "Снять выделение" : "Выбрать все"}
              </button>
              <button 
                onClick={handleDelete}
                disabled={selectedIds.size === 0 || deleting}
                className="px-3.5 py-2 bg-[#e30613] hover:bg-[#c20510] disabled:opacity-50 transition rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-[#e30613]/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Удалить {selectedIds.size > 0 && `(${selectedIds.size})`}
              </button>
            </>
          )}

          <button 
            onClick={() => {
              if (selectionMode) {
                setSelectionMode(false);
                setSelectedIds(new Set());
              } else {
                setSelectionMode(true);
              }
            }}
            className={`px-3.5 py-2 transition rounded-xl text-xs font-bold ${
              selectionMode 
                ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200" 
                : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
            }`}
          >
            {selectionMode ? "Отмена" : "Выбрать"}
          </button>
        </div>
      </div>

      {activeTab === "snapshots" && (
        loading && snapshots.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-white dark:bg-[#161b22] rounded-3xl border border-zinc-200 dark:border-zinc-800/60 shadow-xl shadow-zinc-200/20 dark:shadow-none animate-fade-in">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4">
              <ArchiveX className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Снапшоты отсутствуют</h3>
            <p className="text-sm text-zinc-500 font-medium mt-1">Здесь будут появляться фотографии со звонков.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {groupKeys.map(key => {
              const list = grouped[key];
              if (!list || list.length === 0) return null;

              return (
                <div key={key} className="space-y-4">
                  <h3 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">
                    {key}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {list.map(snapshot => {
                      const isSelected = selectedIds.has(snapshot.id);
                      const date = new Date(snapshot.timestamp);
                      const timeString = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                      
                      return (
                        <div 
                          key={snapshot.id} 
                          className={`relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group border-2 transition-all ${
                            isSelected ? "border-[#e30613] scale-[0.98]" : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                          }`}
                          onClick={() => {
                            if (selectionMode) {
                              toggleSelection(snapshot.id);
                            } else {
                              setPreviewSnapshot(snapshot);
                            }
                          }}
                        >
                          <img 
                            src={`${import.meta.env.VITE_API_BASE_URL || ""}/api/domru/snapshots/${snapshot.fileName}?login=${credentials?.login || ''}`}
                            className={`w-full h-full object-cover transition-opacity ${deleting && isSelected ? 'opacity-50' : 'opacity-100'}`}
                            alt="Snapshot"
                            loading="lazy"
                          />
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 transition-opacity" />
                          
                          <div className="absolute bottom-2 left-2 text-white/90 text-xs font-bold drop-shadow-md bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-md">
                            {timeString}
                          </div>

                          {selectionMode && (
                            <div className="absolute top-2 right-2">
                              {isSelected ? (
                                <div className="bg-white rounded-full text-[#e30613] shadow-md">
                                  <CheckSquare className="w-5 h-5" />
                                </div>
                              ) : (
                                <div className="bg-black/20 rounded-full text-white/70 backdrop-blur-md">
                                  <Square className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === "faceId" && (
        loading && faceIdKeys.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
        ) : faceIdKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-white dark:bg-[#161b22] rounded-3xl border border-zinc-200 dark:border-zinc-800/60 shadow-xl shadow-zinc-200/20 dark:shadow-none animate-fade-in">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4">
              <ArchiveX className="w-8 h-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Нет загруженных фото</h3>
            <p className="text-sm text-zinc-500 font-medium mt-1">Здесь появятся фотографии жильцов для плагина Face ID.</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-1">
              Загруженные лица
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {faceIdKeys.map(key => {
                const isSelected = selectedIds.has(key);
                
                return (
                  <div 
                    key={key} 
                    className={`relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group border-2 transition-all ${
                      isSelected ? "border-[#e30613] scale-[0.98]" : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelection(key);
                      } else {
                        setPreviewFaceId(key);
                      }
                    }}
                  >
                    <img 
                      src={`${import.meta.env.VITE_API_BASE_URL || ""}/api/plugins/face-id/image/${key}`}
                      className={`w-full h-full object-cover transition-opacity ${deleting && isSelected ? 'opacity-50' : 'opacity-100'}`}
                      alt="Face ID"
                      loading="lazy"
                    />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-100 transition-opacity" />
                    
                    <div className="absolute bottom-2 left-2 text-white/90 text-[10px] font-bold drop-shadow-md bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-md truncate max-w-[90%]">
                      {peopleNames[key] || `ID: ${key}`}
                    </div>

                    {selectionMode && (
                      <div className="absolute top-2 right-2">
                        {isSelected ? (
                          <div className="bg-white rounded-full text-[#e30613] shadow-md">
                            <CheckSquare className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="bg-black/20 rounded-full text-white/70 backdrop-blur-md">
                            <Square className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Preview Modal for Snapshots */}
      {previewSnapshot && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setPreviewSnapshot(null)}
        >
          <img 
            src={`${import.meta.env.VITE_API_BASE_URL || ""}/api/domru/snapshots/${previewSnapshot.fileName}?login=${encodeURIComponent(credentials?.login || '')}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            onClick={() => setPreviewSnapshot(null)}
          >
            <ArchiveX className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Preview Modal for Face ID */}
      {previewFaceId && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setPreviewFaceId(null)}
        >
          <img 
            src={`${import.meta.env.VITE_API_BASE_URL || ""}/api/plugins/face-id/image/${previewFaceId}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-default"
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
            onClick={() => setPreviewFaceId(null)}
          >
            <ArchiveX className="w-6 h-6 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
