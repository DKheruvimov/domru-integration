import { useState, useEffect, useMemo } from "react";
import { Trash2, CheckSquare, Square, Check, RefreshCw, ArchiveX } from "lucide-react";
import type { StorageSnapshot, AppCredentials } from "../../types";

export default function StorageView({ credentials }: { credentials?: AppCredentials }) {
  const [snapshots, setSnapshots] = useState<StorageSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const headers: HeadersInit = {};
      if (credentials) {
        headers["x-domru-login"] = credentials.login;
        headers["x-domru-password"] = credentials.password;
        if (credentials.token) headers["x-domru-token"] = credentials.token;
      }
      
      const res = await fetch("/api/domru/snapshots/history", { headers });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSnapshots(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSnapshots, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === snapshots.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(snapshots.map((s) => s.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirm = window.confirm(`Удалить ${selectedIds.size} фото?`);
    if (!confirm) return;

    setDeleting(true);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (credentials) {
        headers["x-domru-login"] = credentials.login;
        headers["x-domru-password"] = credentials.password;
        if (credentials.token) headers["x-domru-token"] = credentials.token;
      }

      await fetch("/api/domru/snapshots/delete", {
        method: "POST",
        headers,
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      setSelectedIds(new Set());
      setSelectionMode(false);
      await loadSnapshots();
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Хранилище</h2>
          <p className="text-sm text-zinc-500 font-medium mt-1">Фотографии со звонков ({snapshots.length})</p>
        </div>
        
        <div className="flex items-center gap-2">
          {selectionMode && (
            <>
              <button 
                onClick={toggleSelectAll}
                className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300"
              >
                {selectedIds.size === snapshots.length ? "Снять выделение" : "Выбрать все"}
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

      {loading && snapshots.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 bg-white dark:bg-[#161b22] rounded-3xl border border-zinc-200 dark:border-zinc-800/60 shadow-xl shadow-zinc-200/20 dark:shadow-none">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-4">
            <ArchiveX className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Хранилище пусто</h3>
          <p className="text-sm text-zinc-500 font-medium mt-1">Здесь будут появляться фотографии со звонков.</p>
        </div>
      ) : (
        <div className="space-y-8">
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
                            // Expand preview (omitted for brevity, could be added later)
                            setSelectionMode(true);
                            toggleSelection(snapshot.id);
                          }
                        }}
                      >
                        <img 
                          src={`/api/domru/snapshots/${snapshot.fileName}?login=${credentials?.login || ''}`}
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
      )}
    </div>
  );
}
