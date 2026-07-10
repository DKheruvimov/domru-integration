import React, { useState, useEffect } from "react";
import { Plug, Plus, Trash2, KeyRound, Clock, Activity, CheckCircle2, XCircle, Settings2, Save, AlertCircle } from "lucide-react";

import { getSocket } from "../socket";

export type FieldType = "string" | "password" | "number" | "boolean" | "select";

export interface ModuleConfigField {
  key: string;
  type: FieldType;
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: any;
  options?: { label: string, value: string }[];
}

export interface ExternalModule {
  id: string;
  name: string;
  token: string;
  createdAt: number;
  connection?: {
    type: "websocket" | "webhook" | "long_polling";
    webhookUrl?: string;
  };
  configSchema?: {
    instruction?: string;
    fields: ModuleConfigField[];
  };
  configValues?: Record<string, any>;
}

export default function ModulesView() {
  const [modules, setModules] = useState<ExternalModule[]>([]);
  const [onlineModules, setOnlineModules] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchModules();
    
    const socket = getSocket();
    const handleStatusChanged = (activeIds: string[]) => setOnlineModules(activeIds);
    const handleStateUpdated = (payload: { moduleId: string, status: string, message?: string }) => {
      setModules(prev => prev.map(m => m.id === payload.moduleId ? { ...m, status: payload.status as any, statusMessage: payload.message } : m));
    };
    const handleSchemaUpdated = (payload: { moduleId: string, schema: any }) => {
      setModules(prev => prev.map(m => m.id === payload.moduleId ? { ...m, configSchema: payload.schema } : m));
    };
    
    socket.on("modules_status_changed", handleStatusChanged);
    socket.on("module_state_updated", handleStateUpdated);
    socket.on("module_schema_updated", handleSchemaUpdated);
    socket.emit("get_modules_status");
    
    return () => {
      socket.off("modules_status_changed", handleStatusChanged);
      socket.off("module_state_updated", handleStateUpdated);
      socket.off("module_schema_updated", handleSchemaUpdated);
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
        setModules(prev => [...prev, newMod]);
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
    if (editingModule === mod.id) {
      setEditingModule(null);
      return;
    }
    setEditingModule(mod.id);
    setEditValues(mod.configValues || {});
  };

  const getModuleStatus = (mod: ExternalModule, isOnline: boolean) => {
    // Removed the aggressive override here so that we trust mod.status (which the server maintains)

    // If module provided explicit status, use it
    if (mod.status === "error") {
      return {
        state: "error",
        label: "Ошибка",
        tooltip: mod.statusMessage || "Произошла ошибка в работе плагина.",
        icon: <XCircle className="w-3 h-3" />,
        className: "text-red-500 bg-red-50 dark:bg-red-500/10"
      };
    }
    
    if (mod.status === "warning") {
      return {
        state: "warning",
        label: "Ожидание настройки",
        tooltip: mod.statusMessage || "Плагин подключен (токен проброшен), но ожидает конфигурации.",
        icon: <AlertCircle className="w-3 h-3" />,
        className: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800"
      };
    }
    
    if (mod.status === "online") {
      return {
        state: "online",
        label: "В сети",
        tooltip: mod.statusMessage || "Плагин успешно подключился и готов к работе.",
        icon: <CheckCircle2 className="w-3 h-3" />,
        className: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
      };
    }

    if (mod.status === "offline") {
      return { 
        state: "offline", 
        label: "Не в сети", 
        tooltip: mod.statusMessage || "Модуль отключен.",
        icon: <XCircle className="w-3 h-3" />,
        className: "text-red-500 bg-red-50 dark:bg-red-500/10"
      };
    }

    // Fallback logic for legacy modules (no explicit status)
    const hasConnection = isOnline || mod.connection?.type === "webhook";
    
    if (!hasConnection) {
      return { 
        state: "offline", 
        label: "Не в сети", 
        tooltip: "Модуль не подключен. Запустите скрипт или настройте webhook.",
        icon: <XCircle className="w-3 h-3" />,
        className: "text-red-500 bg-red-50 dark:bg-red-500/10"
      };
    }

    let missingRequired = false;
    if (mod.configSchema?.fields) {
      for (const field of mod.configSchema.fields) {
        if (field.required && !mod.configValues?.[field.key]) {
          missingRequired = true;
          break;
        }
      }
    }

    if (missingRequired) {
      return { 
        state: "warning", 
        label: "Требует настройки", 
        tooltip: "Модуль подключен, но не может работать, пока вы не заполните обязательные настройки (нажмите на шестеренку).",
        icon: <AlertCircle className="w-3 h-3" />,
        className: "text-amber-500 bg-amber-50 dark:bg-amber-500/10"
      };
    }

    return { 
      state: "online", 
      label: "В сети", 
      tooltip: "Модуль подключен и готов к работе.",
      icon: <CheckCircle2 className="w-3 h-3" />,
      className: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
    };
  };

  const saveSettings = async (id: string) => {
    try {
      const res = await fetch("/api/modules/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, values: editValues })
      });
      if (res.ok) {
        setModules(prev => prev.map(m => m.id === id ? { ...m, configValues: editValues } : m));
        setEditingModule(null);
      } else {
        alert("Ошибка сохранения настроек");
      }
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  return (
    <div className="space-y-6 pb-6 animate-fade-in" id="modules_panel">
      {/* Intro Header */}
      <div className="p-4 bg-zinc-100/50 dark:bg-zinc-900/30 border border-zinc-200/40 dark:border-zinc-800/50 rounded-2xl">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold leading-relaxed">
          Внешние модули позволяют подключать к домофону сторонние скрипты и системы (например, скрипт распознавания лиц на Python). 
          Создайте токен доступа и передайте его модулю. (Версия UI: v2.0-sockets)
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
          const status = getModuleStatus(mod, isOnline);
          
          return (
            <div key={mod.id} className="p-4 bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800/60 rounded-2xl shadow-xs flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h5 className="font-extrabold text-sm text-zinc-900 dark:text-white">{mod.name}</h5>
                  <span 
                    title={status.tooltip}
                    className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full cursor-help ${status.className}`}
                  >
                    {status.icon}
                    {status.label}
                  </span>
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
                {mod.configSchema ? (
                  <button
                    onClick={() => startEditing(mod)}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${editingModule === mod.id ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"}`}
                    title="Настройки модуля"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    disabled
                    className="p-2 text-zinc-300 dark:text-zinc-700 rounded-lg cursor-not-allowed"
                    title="Модуль не предоставляет настроек"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              </div>

              {/* Editing Section (Schema-Driven) */}
              {editingModule === mod.id && mod.configSchema && (
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 w-full col-span-full">
                  <div className="space-y-4">
                    {mod.configSchema.instruction && (
                      <div className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 p-3 rounded-xl text-[11px] font-medium leading-relaxed border border-blue-100 dark:border-blue-500/20">
                        {mod.configSchema.instruction}
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {mod.configSchema.fields.map(field => (
                        <div key={field.key} className="space-y-1">
                          <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          
                          {field.type === "string" || field.type === "password" || field.type === "number" ? (
                            <input
                              type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                              value={editValues[field.key] || ""}
                              onChange={e => setEditValues(prev => ({ ...prev, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
                              className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:border-zinc-300 dark:focus:border-zinc-700 transition-colors"
                              required={field.required}
                            />
                          ) : field.type === "boolean" ? (
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={!!editValues[field.key]} 
                                onChange={e => setEditValues(prev => ({ ...prev, [field.key]: e.target.checked }))}
                              />
                              <div className="w-9 h-5 bg-zinc-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                            </label>
                          ) : field.type === "select" ? (
                            <select
                              value={editValues[field.key] || ""}
                              onChange={e => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                              className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:border-zinc-300 dark:focus:border-zinc-700 transition-colors"
                              required={field.required}
                            >
                              <option value="" disabled className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">Выберите...</option>
                              {field.options?.map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">{opt.label}</option>
                              ))}
                            </select>
                          ) : null}
                          
                          {field.description && (
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                              {field.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => saveSettings(mod.id)}
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
