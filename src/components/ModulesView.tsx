import React, { useState, useEffect, useRef } from "react";
import { Plug, Plus, Trash2, KeyRound, Clock, Activity, CheckCircle2, XCircle, Settings2, Save, AlertCircle, Copy, Check, RefreshCw, Info, Power, PowerOff, ImagePlus, ToggleLeft, ToggleRight, User } from "lucide-react";

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
  isEnabled?: boolean;
  capabilities?: Record<string, { label?: string; supportedRoles?: string[]; mediaEndpoint?: string }>;
  connection?: {
    type: "websocket" | "webhook" | "long_polling";
    webhookUrl?: string;
  };
  configSchema?: {
    instruction?: string;
    fields: ModuleConfigField[];
  };
  configValues?: Record<string, any>;
  status?: "online" | "offline" | "error" | "warning";
  statusMessage?: string;
  entityStatuses?: Record<string, {
    entityType: string;
    entityId: string;
    status: "processing" | "success" | "error";
    message?: string;
    updatedAt: number;
  }>;
}

export default function ModulesView() {
  const [modules, setModules] = useState<ExternalModule[]>([]);
  const [onlineModules, setOnlineModules] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [people, setPeople] = useState<any[]>([]);

  const fetchPeople = async () => {
    try {
      const saved = localStorage.getItem("domru_credentials");
      const headers: Record<string, string> = {};
      if (saved) {
        const creds = JSON.parse(saved);
        const authPayload = btoa(encodeURIComponent(JSON.stringify(creds)));
        headers["Authorization"] = `Bearer ${authPayload}`;
      }
      const res = await fetch("/api/domru/people", { headers });
      if (res.ok) {
        const data = await res.json();
        setPeople(data);
      }
    } catch (e) {
      console.error("Failed to load people", e);
    }
  };
  
  // Custom dialog state for alerts/confirms to bypass iframe constraints
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isConfirm: boolean;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    isConfirm: false,
  });

  const showCustomAlert = (title: string, message: string) => {
    setDialog({
      isOpen: true,
      title,
      message,
      isConfirm: false,
    });
  };

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialog({
      isOpen: true,
      title,
      message,
      isConfirm: true,
      onConfirm,
    });
  };

  const resetIntegration = (id: string) => {
    showCustomConfirm(
      "Сброс интеграции",
      "Сбросить интеграцию модуля? Все его настройки, зарегистрированные возможности и сохраненный контент (например, фотографии) будут безвозвратно удалены из системы домофона.",
      async () => {
        try {
          const res = await fetch("/api/modules/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          });
          if (res.ok) {
            // Update local state: clear configValues and status/entityStatuses
            setModules(prev => prev.map(m => m.id === id ? { 
              ...m, 
              configValues: {}, 
              status: "offline", 
              statusMessage: undefined,
              entityStatuses: {},
              capabilities: undefined
            } : m));
            setEditValues({});
            setEditingModule(null);
            showCustomAlert("Успех", "Интеграция модуля успешно сброшена. Все связанные данные и конфигурация очищены.");
          } else {
            showCustomAlert("Ошибка", "Не удалось сбросить интеграцию модуля.");
          }
        } catch (e) {
          console.error("Failed to reset module integration", e);
          showCustomAlert("Ошибка", "Произошла сетевая ошибка при сбросе интеграции.");
        }
      }
    );
  };

  const toggleModuleEnabled = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch("/api/modules/toggle-enabled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isEnabled: !currentEnabled })
      });
      if (res.ok) {
        const data = await res.json();
        setModules(prev => prev.map(m => m.id === id ? { ...m, isEnabled: data.isEnabled } : m));
      } else {
        showCustomAlert("Ошибка", "Не удалось изменить статус активности модуля.");
      }
    } catch (e) {
      console.error("Failed to toggle module status", e);
      showCustomAlert("Ошибка", "Произошла сетевая ошибка при переключении статуса.");
    }
  };

  useEffect(() => {
    fetchModules();
    fetchPeople();
    
    const socket = getSocket();
    const handleStatusChanged = (activeIds?: string[]) => {
      if (activeIds && Array.isArray(activeIds)) {
        setOnlineModules(activeIds);
      } else {
        fetchModules();
      }
    };
    const handleStateUpdated = (payload: { moduleId: string, status: string, message?: string }) => {
      if (!payload || !payload.moduleId) return;
      setModules(prev => prev.map(m => m.id === payload.moduleId ? { ...m, status: payload.status as any, statusMessage: payload.message } : m));
    };
    const handleSchemaUpdated = (payload: { moduleId: string, schema: any }) => {
      if (!payload || !payload.moduleId) return;
      setModules(prev => prev.map(m => m.id === payload.moduleId ? { ...m, configSchema: payload.schema } : m));
    };
    const handleEntityStatusUpdated = (payload: { moduleId: string, entityType: string, entityId: string, status: any, message?: string }) => {
      if (!payload || !payload.moduleId) return;
      setModules(prev => prev.map(m => {
        if (m.id === payload.moduleId) {
          const key = `${payload.entityType}_${payload.entityId}`;
          const currentEntityStatuses = m.entityStatuses || {};
          return {
            ...m,
            entityStatuses: {
              ...currentEntityStatuses,
              [key]: {
                entityType: payload.entityType,
                entityId: payload.entityId,
                status: payload.status,
                message: payload.message,
                updatedAt: Date.now()
              }
            }
          };
        }
        return m;
      }));
    };
    
    socket.on("modules_status_changed", handleStatusChanged);
    socket.on("module_state_updated", handleStateUpdated);
    socket.on("module_schema_updated", handleSchemaUpdated);
    socket.on("entity_status_updated", handleEntityStatusUpdated);
    socket.emit("get_modules_status");
    
    return () => {
      socket.off("modules_status_changed", handleStatusChanged);
      socket.off("module_state_updated", handleStateUpdated);
      socket.off("module_schema_updated", handleSchemaUpdated);
      socket.off("entity_status_updated", handleEntityStatusUpdated);
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

  const deleteModule = (id: string) => {
    showCustomConfirm(
      "Удаление модуля",
      "Вы уверены, что хотите удалить этот модуль? Это действие полностью удалит его из списка подключенных.",
      async () => {
        try {
          const res = await fetch(`/api/modules/delete`, { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          });
          if (res.ok) {
            setModules(prev => prev.filter(m => m.id !== id));
          } else {
            showCustomAlert("Ошибка", "Ошибка удаления: " + await res.text());
          }
        } catch (e) {
          console.error("Failed to delete module", e);
          showCustomAlert("Ошибка", "Ошибка сети при удалении");
        }
      }
    );
  };

  const startEditing = (mod: ExternalModule) => {
    if (editingModule === mod.id) {
      setEditingModule(null);
      return;
    }
    setEditingModule(mod.id);
    setEditValues(mod.configValues || {});
  };

  const handleCopy = (token: string, id: string) => {
    navigator.clipboard.writeText(token);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getModuleStatus = (mod: ExternalModule, isOnline: boolean) => {
    // If the module is explicitly disabled
    if (mod.isEnabled === false) {
      return {
        state: "disabled",
        label: "Выключен",
        tooltip: "Модуль отключен в настройках ядра.",
        icon: <PowerOff className="w-3 h-3 text-red-500" />,
        className: "text-red-600 bg-red-50 dark:bg-red-950/20"
      };
    }

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
        label: "Требуется настройка",
        tooltip: mod.statusMessage || "Плагин подключен (токен проброшен), но ожидает конфигурации.",
        icon: <AlertCircle className="w-3 h-3" />,
        className: "text-amber-500 bg-amber-50 dark:bg-amber-500/10"
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
        icon: <Plug className="w-3 h-3" />,
        className: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800"
      };
    }

    // Fallback logic for legacy modules (no explicit status)
    const hasConnection = isOnline || mod.connection?.type === "webhook";
    
    if (!hasConnection) {
      return { 
        state: "offline", 
        label: "Не в сети", 
        tooltip: "Модуль не подключен. Запустите скрипт или настройте webhook.",
        icon: <Plug className="w-3 h-3" />,
        className: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800"
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

  const saveSettings = async (id: string, schema?: { fields: ModuleConfigField[] }) => {
    if (schema?.fields) {
      const missingFields = schema.fields.filter(f => {
        if (!f.required) return false;
        if (f.type === "boolean") return false;
        const val = editValues[f.key];
        return val === undefined || val === null || val === "";
      });
      if (missingFields.length > 0) {
        showCustomAlert("Заполните поля", `Пожалуйста, заполните обязательные поля: ${missingFields.map(f => f.label).join(", ")}`);
        return;
      }
    }

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
        showCustomAlert("Ошибка", "Ошибка сохранения настроек");
      }
    } catch (e) {
      console.error("Failed to save settings", e);
      showCustomAlert("Ошибка", "Ошибка сети при сохранении настроек");
    }
  };

  // ── Helpers для карточек людей в блоке «Статусы обработки» ──────────────

  /** Получить первый capability этого модуля */
  const getFirstCapKey = (mod: ExternalModule): string | null => {
    const caps = (mod as any).capabilities;
    if (!caps) return null;
    const keys = Object.keys(caps);
    return keys.length > 0 ? keys[0] : null;
  };

  /** Переключить capability для конкретного жильца */
  const togglePersonCapability = async (person: any, capKey: string, currentValue: boolean) => {
    try {
      const saved = localStorage.getItem("domru_credentials");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (saved) {
        const creds = JSON.parse(saved);
        headers["Authorization"] = `Bearer ${btoa(encodeURIComponent(JSON.stringify(creds)))}`;
      }
      const updatedPeople = people.map((p: any) =>
        p.id === person.id
          ? { ...p, pluginSettings: { ...(p.pluginSettings || {}), [capKey]: !currentValue } }
          : p
      );
      const res = await fetch("/api/domru/people", {
        method: "POST",
        headers,
        body: JSON.stringify({ people: updatedPeople }),
      });
      if (res.ok) {
        setPeople(updatedPeople);
      } else {
        showCustomAlert("Ошибка", "Не удалось сохранить настройки жильца.");
      }
    } catch (e) {
      console.error("Failed to toggle person capability", e);
      showCustomAlert("Ошибка", "Ошибка сети при сохранении настроек жильца.");
    }
  };

  /** Загрузить фото для жильца в хранилище модуля */
  const handlePersonPhotoUpload = async (moduleId: string, personId: string, file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64Data = ev.target?.result as string;
        const res = await fetch(`/api/modules/storage/${moduleId}/${personId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data }),
        });
        if (!res.ok) {
          showCustomAlert("Ошибка", "Не удалось загрузить фотографию.");
        }
        // Принудительно перезагрузим аватар через cache-bust
        setModules(prev => [...prev]);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error("Failed to upload photo", e);
      showCustomAlert("Ошибка", "Ошибка при загрузке фотографии.");
    }
  };

  /** Удалить фото жильца из хранилища модуля */
  const handlePersonPhotoDelete = async (moduleId: string, personId: string) => {
    try {
      const res = await fetch(`/api/modules/storage/${moduleId}/${personId}`, { method: "DELETE" });
      if (!res.ok) showCustomAlert("Ошибка", "Не удалось удалить фотографию.");
      setModules(prev => [...prev]);
    } catch (e) {
      showCustomAlert("Ошибка", "Ошибка сети при удалении фотографии.");
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
          const isOnline = (onlineModules || []).includes(mod.id);
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
                <div className="flex-1 sm:flex-none flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-3 pr-1 py-1 min-w-[200px]">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-400 shrink-0 mr-2" />
                  <code className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 truncate w-full select-all mr-2">
                    {mod.token}
                  </code>
                  <button
                    onClick={() => handleCopy(mod.token, mod.id)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors shrink-0 cursor-pointer"
                    title="Копировать токен"
                  >
                    {copiedId === mod.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  onClick={() => toggleModuleEnabled(mod.id, mod.isEnabled !== false)}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    mod.isEnabled !== false 
                      ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20" 
                      : "text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  }`}
                  title={mod.isEnabled !== false ? "Выключить модуль" : "Включить модуль"}
                >
                  {mod.isEnabled !== false ? (
                    <Power className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-zinc-400" />
                  )}
                </button>
                <button
                  onClick={() => deleteModule(mod.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                  title="Удалить модуль"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => startEditing(mod)}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${editingModule === mod.id ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"}`}
                  title="Настройки модуля"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              </div>
              </div>

              {/* Editing Section (Schema-Driven) */}
              {editingModule === mod.id && (
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 w-full col-span-full">
                  <div className="space-y-6">
                    {/* System Information */}
                    {mod.connection?.type === "webhook" && mod.connection.webhookUrl && (
                      <div className="space-y-1 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/60 p-3 rounded-xl">
                        <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                          URL вебхука
                        </label>
                        <code className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300 break-all select-all block">
                          {mod.connection.webhookUrl}
                        </code>
                      </div>
                    )}
                    
                    {mod.configSchema ? (
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
                              onChange={e => setEditValues(prev => ({ ...prev, [field.key]: field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value }))}
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
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 p-3 text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/50 dark:border-zinc-800/60">
                        <Settings2 className="w-4 h-4 opacity-50" />
                        <p className="text-[11px] font-medium">Этот модуль не предоставляет дополнительных настроек.</p>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 gap-2">
                      <button
                        type="button"
                        onClick={() => resetIntegration(mod.id)}
                        className="px-4 py-2 text-red-500 hover:text-white hover:bg-red-500 border border-red-500/20 dark:border-red-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-transparent"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Сбросить интеграцию
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingModule(null)}
                          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        >
                          Отмена
                        </button>
                        {mod.configSchema && (
                          <button
                            type="button"
                            onClick={() => saveSettings(mod.id, mod.configSchema)}
                            className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Сохранить настройки
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Entity Statuses Display — enriched with photo + capability toggle */}
              {mod.entityStatuses && Object.keys(mod.entityStatuses).length > 0 && (() => {
                const capKey = getFirstCapKey(mod);
                const hasMedia = !!(mod as any).capabilities?.[capKey ?? ""]?.mediaEndpoint;
                return (
                  <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 w-full col-span-full">
                    <div className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">
                      Статусы обработки
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.values(mod.entityStatuses).map((status: any) => {
                        const person = people.find((p: any) => p.id === status.entityId);
                        const capEnabled = capKey ? !!(person?.pluginSettings?.[capKey]) : false;
                        const photoUrl = hasMedia
                          ? `/api/modules/storage/${mod.id}/${status.entityId}?t=${mod.entityStatuses?.[`${status.entityType}_${status.entityId}`]?.updatedAt ?? ""}`
                          : null;

                        return (
                          <div
                            key={`${status.entityType}_${status.entityId}`}
                            className="flex items-start gap-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/50 dark:border-zinc-800/60 p-3 rounded-xl"
                          >
                            {/* Avatar / Photo */}
                            <div className="relative shrink-0 group">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={person?.name || status.entityId}
                                  className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center">
                                  <User className="w-5 h-5 text-zinc-400" />
                                </div>
                              )}
                            </div>

                            {/* Info block */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Name + status badge */}
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate">
                                  {status.entityType === "person"
                                    ? (person?.name || `Резидент (ID: ${status.entityId})`)
                                    : `${status.entityType} ${status.entityId}`}
                                </span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                                  status.status === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                  status.status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                  status.status === "disabled" ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50" :
                                  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                }`}>
                                  {status.status === "success" ? "Успех" : status.status === "error" ? "Ошибка" : status.status === "disabled" ? "Отключен" : "В процессе"}
                                </span>
                              </div>

                              {/* Status message */}
                              {status.message && (
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight block">
                                  {status.message}
                                </span>
                              )}

                              {/* Controls: photo upload + capability toggle */}
                              {status.entityType === "person" && (
                                <div className="flex items-center gap-2 pt-0.5">
                                  {/* Photo upload */}
                                  {hasMedia && (
                                    <>
                                      <label
                                        htmlFor={`photo-upload-${mod.id}-${status.entityId}`}
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors"
                                        title="Загрузить фото"
                                      >
                                        <ImagePlus className="w-3 h-3" />
                                        Фото
                                      </label>
                                      <input
                                        id={`photo-upload-${mod.id}-${status.entityId}`}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handlePersonPhotoUpload(mod.id, status.entityId, file);
                                          e.target.value = "";
                                        }}
                                      />
                                      {photoUrl && (
                                        <button
                                          onClick={() => showCustomConfirm(
                                            "Удалить фото",
                                            `Удалить фотографию для ${person?.name || status.entityId}?`,
                                            () => handlePersonPhotoDelete(mod.id, status.entityId)
                                          )}
                                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors"
                                          title="Удалить фото"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </>
                                  )}

                                  {/* Capability toggle */}
                                  {capKey && person && (
                                    <button
                                      onClick={() => togglePersonCapability(person, capKey, capEnabled)}
                                      className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition-colors ml-auto ${
                                        capEnabled
                                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                                          : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                      }`}
                                      title={capEnabled ? "Выключить для этого жильца" : "Включить для этого жильца"}
                                    >
                                      {capEnabled
                                        ? <ToggleRight className="w-3.5 h-3.5" />
                                        : <ToggleLeft className="w-3.5 h-3.5" />}
                                      {capEnabled ? "Вкл" : "Выкл"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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

      {dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#161b22] border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col relative p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${dialog.isConfirm ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                <Info className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                {dialog.title}
              </h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
              {dialog.message}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              {dialog.isConfirm ? (
                <>
                  <button
                    onClick={() => setDialog({ ...dialog, isOpen: false })}
                    className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-xl bg-zinc-100 dark:bg-zinc-800 transition cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      setDialog({ ...dialog, isOpen: false });
                      if (dialog.onConfirm) dialog.onConfirm();
                    }}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-md transition cursor-pointer"
                  >
                    Подтвердить
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDialog({ ...dialog, isOpen: false })}
                  className="px-4 py-2 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl shadow-md transition cursor-pointer"
                >
                  ОК
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
