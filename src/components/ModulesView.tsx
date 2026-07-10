import React, { useState, useEffect } from "react";
import { Plug, Plus, Trash2, KeyRound, Clock, Activity, CheckCircle2, XCircle, Settings2, Save } from "lucide-react";

import { getSocket } from "../socket";

export interface ExternalModule {
  id: string;
  name: string;
  token: string;
  createdAt: number;
  connection?: {
    type: "websocket" | "webhook" | "long_polling";
    webhookUrl?: string;
  };
}

export default function ModulesView() {
  const [modules, setModules] = useState<ExternalModule[]>([]);
  const [onlineModules, setOnlineModules] = useState<string[]>([]);
  const [newModuleName, setNewModuleName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editConnection, setEditConnection] = useState<{type: "websocket" | "webhook" | "long_polling", webhookUrl: string}>({ type: "websocket", webhookUrl: "" });

  useEffect(() => {
    fetchModules();
    
    const socket = getSocket();
    const handleStatusChanged = (activeIds: string[]) => setOnlineModules(activeIds);
    
    socket.on("modules_status_changed", handleStatusChanged);
    
    return () => {
      socket.off("modules_status_changed", handleStatusChanged);
    };
  }, []);

  const fetchModules = async () => {
    try {
      const res = await fetch("/api/modules");
      if (res.ok) {
        const data = await res.json();
        setModules(data);
      }
    } catch (e) {
      console.error("Failed to load modules", e);
    }
  };

  const createModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim()) return;
    
    setIsLoading(true);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newModuleName.trim() })
      });
      if (res.ok) {
        const newMod = await res.json();
        setModules([...modules, newMod]);
        setNewModuleName("");
      }
    } catch (e) {
      console.error("Failed to create module", e);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteModule = async (id: string) => {
    if (!window.confirm("Вы уверены, что хотите удалить этот модуль?")) return;
    
    try {
      const res = await fetch(`/api/modules/delete`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setModules(prev => prev.filter(m => m.id !== id));
      } else {
        alert("Ошибка удаления: " + await res.text());
      }
    } catch (e) {
      console.error("Failed to delete module", e);
      alert("Ошибка сети при удалении");
    }
  };

  const startEditing = (mod: ExternalModule) => {
    setEditingModule(mod.id);
    setEditConnection({
      type: mod.connection?.type || "websocket",
      webhookUrl: mod.connection?.webhookUrl || ""
    });
  };

  const saveConnection = async (id: string) => {
    try {
      const res = await fetch(`/api/modules/connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editConnection })
      });
      if (res.ok) {
        setModules(modules.map(m => m.id === id ? { ...m, connection: { type: editConnection.type, webhookUrl: editConnection.webhookUrl } } : m));
        setEditingModule(null);
      }
    } catch (e) {
      console.error("Failed to save connection", e);
    }
  };

  return (
    <div className="space-y-6 pb-6 animate-fade-in" id="modules_panel">
      {/* Intro Header */}
      <div className="p-4 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200/40 dark:border-zinc-800/50 rounded-2xl">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
          Внешние модули позволяют подключать к домофону сторонние скрипты и системы (например, скрипт распознавания лиц на Python). 
          Создайте токен доступа и передайте его модулю.
        </p>
      </div>

      {/* Create Module */}
      <div className="p-5 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl shadow-xs space-y-4">
        <h4 className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
          <Plug className="w-4 h-4 text-emerald-500" />
          Добавить модуль
        </h4>
        <form onSubmit={createModule} className="flex items-center gap-3">
          <input
            type="text"
            value={newModuleName}
            onChange={(e) => setNewModuleName(e.target.value)}
            placeholder="Название (например, FaceID Python)"
            className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!newModuleName.trim() || isLoading}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white rounded-xl text-xs font-extrabold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Создать
          </button>
        </form>
      </div>

      {/* Modules List */}
      <div className="space-y-3">
        {modules.map(mod => {
          const isOnline = onlineModules.includes(mod.id);
          return (
            <div key={mod.id} className="p-4 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl shadow-xs flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h5 className="font-extrabold text-sm text-zinc-900 dark:text-white">{mod.name}</h5>
                  {isOnline ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" />
                      В сети
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" />
                      Не в сети
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(mod.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-600 dark:text-zinc-300">
                    <Activity className="w-3 h-3" />
                    {mod.connection?.type === "webhook" ? "Webhook" : mod.connection?.type === "long_polling" ? "Long Polling" : "WebSocket"}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 sm:flex-none flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 min-w-[200px]">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-2" />
                  <code className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 truncate w-full select-all">
                    {mod.token}
                  </code>
                </div>
                <button
                  onClick={() => deleteModule(mod.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Удалить модуль"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editingModule === mod.id ? setEditingModule(null) : startEditing(mod)}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${editingModule === mod.id ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"}`}
                  title="Настройки соединения"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
              </div>

              {/* Editing Section */}
              {editingModule === mod.id && (
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 w-full col-span-full">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Тип соединения</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditConnection(prev => ({ ...prev, type: "websocket" }))}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border ${
                            editConnection.type === "websocket"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                              : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                          }`}
                        >
                          WebSocket
                        </button>
                        <button
                          onClick={() => setEditConnection(prev => ({ ...prev, type: "webhook" }))}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border ${
                            editConnection.type === "webhook"
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                              : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                          }`}
                        >
                          Webhook
                        </button>
                        <button
                          onClick={() => setEditConnection(prev => ({ ...prev, type: "long_polling" }))}
                          className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border ${
                            editConnection.type === "long_polling"
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400"
                              : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                          }`}
                        >
                          Long Polling
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 font-medium mt-1">
                        {editConnection.type === "websocket" && "Скрипт должен постоянно работать и держать соединение с Ядром (socket.io)."}
                        {editConnection.type === "webhook" && "Ядро будет отправлять POST-запросы с событиями на указанный вами URL."}
                        {editConnection.type === "long_polling" && "Скрипт будет запрашивать события по мере готовности через HTTP GET (без открытия портов и вебхуков)."}
                      </p>
                    </div>

                    {editConnection.type === "webhook" && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Webhook URL</label>
                        <input
                          type="text"
                          value={editConnection.webhookUrl}
                          onChange={e => setEditConnection(prev => ({ ...prev, webhookUrl: e.target.value }))}
                          placeholder="https://example.com/webhook"
                          className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-3 py-2 text-xs font-mono text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:border-zinc-300 dark:focus:border-zinc-700"
                        />
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => saveConnection(mod.id)}
                        className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Сохранить настройки
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {modules.length === 0 && (
          <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-xs font-bold">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Нет подключенных модулей
          </div>
        )}
      </div>
    </div>
  );
}
