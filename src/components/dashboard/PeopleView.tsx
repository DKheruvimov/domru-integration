import { useState, useEffect } from "react";
import { Person, ScheduleRule, GuestPin } from "../../types";
import { 
  Clock, 
  Plus, 
  Trash2, 
  Edit, 
  Calendar, 
  User, 
  UserCheck, 
  Truck, 
  Users, 
  X, 
  Check, 
  AlertCircle,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Camera,
  ImagePlus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getSocket } from "../../socket";

interface PeopleViewProps {
  pins: GuestPin[];
  makeGuestPin: () => void;
  proxyHeaders: Record<string, string>;
  isDevModeEnabled?: boolean;
}

const WEEKDAYS = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

export default function PeopleView({ pins, makeGuestPin, proxyHeaders, isDevModeEnabled }: PeopleViewProps) {
  const CAPABILITIES = isDevModeEnabled ? ["FACE_RECOGNITION"] : [];
  const hasFaceRec = CAPABILITIES.includes("FACE_RECOGNITION");

  const [activeSubTab, setActiveSubTab] = useState<"schedules" | "pins">("schedules");
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHelpText, setShowHelpText] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [role, setRole] = useState<"resident" | "guest" | "courier">("resident");
  const [enabled, setEnabled] = useState(true);
  const [maxOpens, setMaxOpens] = useState<number | "">("");
  const [useSchedule, setUseSchedule] = useState(true);
  const [useFaceRec, setUseFaceRec] = useState(false);
  const [hasFacePhoto, setHasFacePhoto] = useState(false);
  const [facePhotoBase64, setFacePhotoBase64] = useState<string>("");
  const [schedules, setSchedules] = useState<ScheduleRule[]>([
    { id: "s1", days: [1, 2, 3, 4, 5], startTime: "18:00", endTime: "19:00" }
  ]);

  // Fetch people list
  const fetchPeople = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/domru/people", {
        headers: { ...proxyHeaders },
      });
      if (!res.ok) throw new Error("Ошибка при получении списка расписаний");
      const data = await res.json();
      setPeople(data);
    } catch (err: any) {
      setError(err.message || "Не удалось загрузить людей");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
    
    const socket = getSocket();
    socket.on("auto_open_status_changed", fetchPeople);
    
    return () => {
      socket.off("auto_open_status_changed", fetchPeople);
    };
  }, []);

  // Save full list
  const savePeopleList = async (updatedList: Person[]) => {
    try {
      const res = await fetch("/api/domru/people", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...proxyHeaders },
        body: JSON.stringify({ people: updatedList }),
      });
      if (!res.ok) throw new Error("Ошибка при сохранении расписаний");
      const data = await res.json();
      setPeople(data.people);
    } catch (err: any) {
      alert(err.message || "Ошибка при сохранении");
    }
  };

  // Toggle single person
  const handleTogglePerson = async (id: string, currentEnabled: boolean) => {
    const target = people.find(p => p.id === id);
    if (!target) return;

    const newEnabled = !currentEnabled;
    const updatedPerson = { ...target, enabled: newEnabled };

    if (newEnabled && updatedPerson.useSchedule === false && !updatedPerson.pluginSettings?.FACE_RECOGNITION) {
      updatedPerson.useSchedule = true;
    }

    const updated = people.map(p => p.id === id ? updatedPerson : p);
    setPeople(updated); // Optimistic
    try {
      await fetch("/api/domru/people", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...proxyHeaders },
        body: JSON.stringify({ people: updated }),
      });
    } catch (err) {
      // Revert on error
      setPeople(people);
    }
  };

  // Delete person
  const handleDeletePerson = (id: string) => {
    const target = people.find(p => p.id === id);
    if (target) {
      setPersonToDelete(target);
    }
  };

  const confirmDeletePerson = () => {
    if (personToDelete) {
      const updated = people.filter(p => p.id !== personToDelete.id);
      savePeopleList(updated);
      setPersonToDelete(null);
    }
  };

  // Open Add/Edit Modal
  const openModal = (person?: Person) => {
    if (person) {
      setEditingPerson(person);
      setName(person.name);
      setRole(person.role);
      setEnabled(person.enabled);
      setMaxOpens(person.maxOpens !== undefined && person.maxOpens !== null ? person.maxOpens : "");
      setSchedules(person.schedules);
      setUseSchedule(hasFaceRec ? (person.useSchedule !== false) : true);
      setUseFaceRec(!!person.pluginSettings?.FACE_RECOGNITION);
      setHasFacePhoto(!!person.hasFacePhoto);
      setFacePhotoBase64("");
    } else {
      setEditingPerson(null);
      setName("");
      setRole("resident");
      setEnabled(true);
      setMaxOpens("");
      setSchedules([
        { id: Math.random().toString(36).substr(2, 9), days: [1, 2, 3, 4, 5], startTime: "18:00", endTime: "19:00" }
      ]);
      setUseSchedule(true);
      setUseFaceRec(false);
      setHasFacePhoto(false);
      setFacePhotoBase64("");
    }
    setIsModalOpen(true);
  };

  // Add/remove a rule inside the form
  const addScheduleRule = () => {
    setSchedules([
      ...schedules,
      {
        id: Math.random().toString(36).substr(2, 9),
        days: [1],
        startTime: "18:00",
        endTime: "19:00"
      }
    ]);
  };

  const removeScheduleRule = (ruleId: string) => {
    if (schedules.length > 1) {
      setSchedules(schedules.filter(r => r.id !== ruleId));
    }
  };

  const updateRuleDays = (ruleId: string, day: number) => {
    setSchedules(
      schedules.map(r => {
        if (r.id !== ruleId) return r;
        const exists = r.days.includes(day);
        const nextDays = exists ? r.days.filter(d => d !== day) : [...r.days, day];
        return { ...r, days: nextDays };
      })
    );
  };

  const updateRuleTimes = (ruleId: string, field: "startTime" | "endTime", val: string) => {
    setSchedules(
      schedules.map(r => (r.id === ruleId ? { ...r, [field]: val } : r))
    );
  };

  // Form Submit
  const handleSavePerson = () => {
    if (!name.trim()) {
      alert("Пожалуйста, введите имя.");
      return;
    }

    let finalEnabled = enabled;
    const finalUseSchedule = hasFaceRec ? useSchedule : true;
    if (finalUseSchedule === false && !useFaceRec) {
      finalEnabled = false;
    }

    const newPerson: Person = {
      id: editingPerson ? editingPerson.id : Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      role,
      enabled: finalEnabled,
      schedules,
      maxOpens: role !== "resident" && maxOpens !== "" ? Number(maxOpens) : null,
      opensRemaining: editingPerson
        ? (editingPerson.opensRemaining !== undefined ? editingPerson.opensRemaining : (role !== "resident" && maxOpens !== "" ? Number(maxOpens) : null))
        : (role !== "resident" && maxOpens !== "" ? Number(maxOpens) : null),
      expiresAt: editingPerson ? editingPerson.expiresAt : undefined,
      lastOpenedDate: editingPerson ? editingPerson.lastOpenedDate : undefined,
      useSchedule: finalUseSchedule,
      pluginSettings: { FACE_RECOGNITION: useFaceRec },
      hasFacePhoto: editingPerson ? editingPerson.hasFacePhoto : false,
    };

    // Upload photo if changed
    if (facePhotoBase64) {
      fetch(`/api/plugins/face-id/image/${newPerson.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: facePhotoBase64 })
      }).catch(console.error);
      newPerson.hasFacePhoto = true;
    } else if (!hasFacePhoto && editingPerson?.hasFacePhoto) {
      fetch(`/api/plugins/face-id/image/${newPerson.id}`, { method: 'DELETE' }).catch(console.error);
      newPerson.hasFacePhoto = false;
    } else {
      newPerson.hasFacePhoto = hasFacePhoto;
    }

    // If it's a temporary event and was edited, update its expiresAt based on the latest endTime
    if (newPerson.id.startsWith("temp-") && newPerson.schedules.length > 0) {
      const now = new Date();
      // Find the latest endTime in minutes
      let maxMinutes = 0;
      for (const rule of newPerson.schedules) {
         const [h, m] = rule.endTime.split(":").map(Number);
         const mins = h * 60 + m;
         if (mins > maxMinutes) maxMinutes = mins;
      }
      
      const newExpiresAtDate = new Date(now);
      newExpiresAtDate.setHours(Math.floor(maxMinutes / 60), maxMinutes % 60, 0, 0);
      
      // If the time already passed today, assume it's for tomorrow (add 24h)
      if (newExpiresAtDate.getTime() < now.getTime()) {
         newExpiresAtDate.setDate(newExpiresAtDate.getDate() + 1);
      }
      
      newPerson.expiresAt = newExpiresAtDate.getTime();
    }

    let updatedList: Person[];
    if (editingPerson) {
      updatedList = people.map(p => p.id === editingPerson.id ? newPerson : p);
    } else {
      updatedList = [...people, newPerson];
    }

    savePeopleList(updatedList);
    setIsModalOpen(false);
  };

  // Helpers to format schedules visually
  const formatDays = (days: number[]): string => {
    if (days.length === 7) return "Каждый день";
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return "Пн – Пт";
    if (days.length === 2 && days.includes(0) && days.includes(6)) return "Выходные";
    
    const sorted = [...days].sort((a, b) => {
      // Sort so Monday is first (1), Sunday is last (0)
      const valA = a === 0 ? 7 : a;
      const valB = b === 0 ? 7 : b;
      return valA - valB;
    });

    return sorted.map(d => WEEKDAYS.find(w => w.value === d)?.label || "").join(", ");
  };

  // Evaluate if schedule matches current moment
  const isCurrentlyActive = (person: Person): boolean => {
    if (!person.enabled) return false;
    if (person.role !== "resident" && person.opensRemaining !== undefined && person.opensRemaining !== null && person.opensRemaining <= 0) {
      return false;
    }

    const effectiveUseSchedule = hasFaceRec ? (person.useSchedule !== false) : true;
    if (!effectiveUseSchedule) return false;

    const now = new Date();
    const currentDay = now.getDay();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const minutesSinceMidnight = currentHours * 60 + currentMinutes;

    for (const rule of person.schedules) {
      if (rule.days.includes(currentDay)) {
        const [startH, startM] = rule.startTime.split(":").map(Number);
        const [endH, endM] = rule.endTime.split(":").map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;

        if (minutesSinceMidnight >= startMin && minutesSinceMidnight <= endMin) {
          return true;
        }
      }
    }
    return false;
  };

  const renderPersonCard = (person: Person) => {
    const isActive = isCurrentlyActive(person);
    const effectiveUseSchedule = hasFaceRec ? (person.useSchedule !== false) : true;

    return (
      <div
        key={person.id}
        className={`p-5 rounded-[1.8rem] border transition-all duration-300 flex flex-col justify-between relative overflow-hidden bg-zinc-50 dark:bg-zinc-800/40 hover:shadow-md ${
          isActive 
            ? "border-emerald-500 ring-2 ring-emerald-500/10 dark:ring-emerald-500/5 bg-emerald-50/10 dark:bg-emerald-950/5" 
            : "border-zinc-200 dark:border-zinc-800/60"
        }`}
      >
        {/* Active Status Ribbon top right */}
        {isActive && (
          <div className="absolute top-0 right-0 bg-emerald-500 text-white font-black text-[9px] px-3.5 py-1 rounded-bl-xl uppercase tracking-wider shadow-sm flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
            Активен сейчас
          </div>
        )}

        <div className="space-y-4">
          {/* Avatar and Info Header */}
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm border shadow-xs ${
              person.role === "resident" 
                ? "bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/20" 
                : person.role === "courier"
                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/20"
                : "bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/20"
            }`}>
              {person.role === "resident" ? <UserCheck className="w-5 h-5" /> : person.role === "courier" ? <Truck className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div className="pr-12">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  {person.name}
                </h3>
                <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                  person.role === "resident" 
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30" 
                    : person.role === "courier"
                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
                    : "bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30"
                }`}>
                  {person.role === "resident" ? "Жилец" : person.role === "courier" ? "Курьер" : "Гость"}
                </span>
              </div>

              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold mt-0.5 flex items-center gap-1">
                {person.role !== "resident" && (
                  <span>
                    Лимит: {person.opensRemaining !== null && person.opensRemaining !== undefined ? `${person.opensRemaining} / ${person.maxOpens ?? "∞"}` : "безлимитно"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Schedule list / Face Recognition */}
          {(effectiveUseSchedule || (hasFaceRec && person.role === "resident" && person.pluginSettings?.FACE_RECOGNITION)) && (
            <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800/50 pt-3">
              {/* 1. Schedule Block */}
              {effectiveUseSchedule && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Расписание</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Вкл
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {person.schedules.length > 0 ? (
                      person.schedules.map((rule) => (
                        <div
                          key={rule.id}
                          className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-2"
                        >
                          <Calendar className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                          <span className="text-zinc-800 dark:text-zinc-300">
                            {person.id.startsWith("temp-") ? "Сегодня" : formatDays(rule.days)}
                          </span>
                          <span className="text-zinc-400 dark:text-zinc-500 shrink-0">•</span>
                          <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                          <span className="font-mono text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded-md">
                            {rule.startTime} – {rule.endTime}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[10px] text-zinc-400">Нет интервалов</span>
                    )}
                  </div>
                </div>
              )}

              {/* 2. Face ID Block (Only if plugin is active) */}
              {hasFaceRec && person.role === "resident" && person.pluginSettings?.FACE_RECOGNITION && (
                <div className={`flex flex-col gap-2 ${effectiveUseSchedule ? "border-t border-zinc-100 dark:border-zinc-800/50 pt-3" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">Face ID</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Вкл
                    </span>
                  </div>
                  <div className="flex items-center gap-3 bg-zinc-50/80 dark:bg-zinc-800/60 p-2 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
                    <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0 overflow-hidden border-2 border-white dark:border-zinc-800 shadow-sm">
                      {person.hasFacePhoto ? (
                        <img src={`/api/plugins/face-id/image/${person.id}`} alt="Face" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-bold ${person.hasFacePhoto ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400"}`}>
                        {person.hasFacePhoto ? "Фото загружено" : "Требуется фото"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Toggle and actions */}
        <div className="flex items-center justify-between border-t border-zinc-150 dark:border-zinc-800/50 pt-3 mt-4">
          {/* Active switch */}
          <button
            onClick={() => handleTogglePerson(person.id, person.enabled)}
            className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
              person.enabled 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {person.enabled ? (
              <>
                <ToggleRight className="w-6 h-6 text-emerald-500" />
                <span>Включено</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6" />
                <span>Отключено</span>
              </>
            )}
          </button>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => openModal(person)}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Редактировать"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDeletePerson(person.id)}
              className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer"
              title="Удалить"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 rounded-[2rem] shadow-md space-y-6 animate-fade-in" id="people_view_root">
      {/* Tab Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-white font-display flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#E30613] rounded-full inline-block" />
            Управление доступом
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Настройте умные правила открытия для членов семьи, регулярных гостей или курьеров
          </p>
        </div>

        {/* Tab switcher buttons */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl self-start md:self-center">
          <button
            onClick={() => setActiveSubTab("schedules")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === "schedules"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Жильцы и Расписания
          </button>
          <button
            onClick={() => setActiveSubTab("pins")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === "pins"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Гостевые PIN-коды
          </button>
        </div>
      </div>

      {activeSubTab === "schedules" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Правила авто-открытия ({people.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHelpText(!showHelpText)}
                className={`p-1.5 rounded-full transition cursor-pointer flex items-center justify-center ${showHelpText ? "bg-[#E30613]/10 text-[#E30613]" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"}`}
                title="Как это работает?"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => openModal()}
                className="flex items-center gap-1 px-4 py-2 bg-[#E30613] hover:bg-[#c20510] text-white text-xs font-black rounded-full transition shadow-md shadow-[#E30613]/10 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить человека</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-xs text-zinc-400">Загрузка правил автооткрытия...</div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-2xl flex items-center gap-2 border border-red-100 dark:border-red-900/30">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Левая колонка: Постоянные жильцы */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-150 dark:border-zinc-800/60">
                  <UserCheck className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Постоянные жильцы ({people.filter(p => p.role === "resident").length})
                  </span>
                </div>
                
                {people.filter(p => p.role === "resident").length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {people.filter(p => p.role === "resident").map((person) => renderPersonCard(person))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[1.8rem]">
                    Постоянные жильцы не настроены
                  </div>
                )}
              </div>

              {/* Правая колонка: Временные гости и курьеры */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-150 dark:border-zinc-800/60">
                  <Truck className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Временные гости и курьеры ({people.filter(p => p.role !== "resident").length})
                  </span>
                </div>

                {people.filter(p => p.role !== "resident").length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {people.filter(p => p.role !== "resident").map((person) => renderPersonCard(person))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[1.8rem]">
                    Нет activeных гостевых или курьерских правил
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick instructions panel */}
          {showHelpText && (
            <div className="bg-[#E30613]/5 border border-[#E30613]/10 p-4 rounded-2xl flex items-start gap-2.5 mt-2 animate-fade-in">
              <HelpCircle className="w-5 h-5 text-[#E30613] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Как это работает?</h4>
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Благодаря интеграции SIP-домофонии, система постоянно слушает входящие звонки. Когда в вашу квартиру звонят в то время, когда у кого-то из жильцов активен интервал расписания, домофон автоматически открывает дверь, имитируя поднятие трубки и нажатие кнопки открытия. Гостевые и курьерские расписания дополнительно ведут счётчик оставшихся открытий и перестают срабатывать, как только лимит исчерпан.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Pin code section identical to original visual */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Временные коды доступа ({pins.length})
            </span>
            <button
              onClick={makeGuestPin}
              className="px-4 py-2 bg-[#E30613] hover:bg-[#c20510] text-white text-xs font-black rounded-full transition shadow-md shadow-[#E30613]/10 cursor-pointer"
            >
              + Создать код
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pins.length > 0 ? (
              pins.map((pin, idx) => (
                <div
                  key={pin.id || idx}
                  className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/60 rounded-2xl flex items-center justify-between shadow-2xs"
                >
                  <div>
                    <div className="text-xs font-extrabold text-zinc-800 dark:text-white">
                      {pin.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                      <span>Истекает: {pin.expiresAt}</span>
                    </div>
                  </div>

                  <div className="px-3.5 py-1.5 bg-[#E30613]/10 border border-[#E30613]/25 text-[#E30613] font-mono font-black text-sm rounded-xl tracking-wider shadow-inner">
                    {pin.code}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-xs text-zinc-400 dark:text-zinc-500 font-semibold">
                Нет активных временных кодов доступа
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Overlay Add / Edit */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between shrink-0">
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-white font-display">
                  {editingPerson ? "Редактировать расписание" : "Добавить новое правило"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Form Row: Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Имя / Описание
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например, Я, Девушка, Курьер Самокат"
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#E30613]/50 focus:ring-1 focus:ring-[#E30613]/30 transition"
                  />
                </div>

                {/* Form Row: Role */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Роль
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "resident", label: "Жилец", icon: UserCheck },
                      { value: "guest", label: "Гость", icon: Users },
                      { value: "courier", label: "Курьер", icon: Truck },
                    ].map((item) => {
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setRole(item.value as any)}
                          className={`py-2 px-3 border rounded-xl text-[11px] font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                            role === item.value
                              ? "bg-[#E30613]/5 border-[#E30613] text-[#E30613]"
                              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form Row: Max opens limit (for guest/courier) */}
                {role !== "resident" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Лимит автооткрытий</span>
                      <span className="text-[10px] text-zinc-400 lowercase font-normal">(оставьте пустым для безлимита)</span>
                    </label>
                    <input
                      type="number"
                      value={maxOpens}
                      onChange={(e) => setMaxOpens(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Например, 1"
                      className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:border-[#E30613]/50 focus:ring-1 focus:ring-[#E30613]/30 transition"
                      min="1"
                    />
                  </div>
                )}

                {/* Form Row: Schedules ALWAYS */}
                <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Автооткрытие по расписанию
                      </label>
                      {hasFaceRec && (
                        <button
                          type="button"
                          onClick={() => setUseSchedule(!useSchedule)}
                          className={`flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${useSchedule ? "text-emerald-500" : "text-zinc-400"}`}
                        >
                          {useSchedule ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      )}
                    </div>
                    {useSchedule && (
                      <button
                        type="button"
                        onClick={addScheduleRule}
                        className="text-[11px] font-bold text-[#E30613] hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        + Добавить интервал
                      </button>
                    )}
                  </div>

                  {useSchedule && (
                    <div className="space-y-3">
                      {schedules.map((rule, sIdx) => (
                        <div
                          key={rule.id}
                          className="p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3 relative"
                        >
                          {/* Remove rule button */}
                          {schedules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeScheduleRule(rule.id)}
                              className="absolute top-3 right-3 text-zinc-400 hover:text-red-500 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                            Интервал #{sIdx + 1}
                          </div>

                          {/* Weekday circular picker */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">Дни недели:</span>
                            <div className="flex flex-wrap gap-1">
                              {WEEKDAYS.map((day) => {
                                const isSelected = rule.days.includes(day.value);
                                return (
                                  <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => updateRuleDays(rule.id, day.value)}
                                    className={`w-8 h-8 rounded-full text-xs font-black transition flex items-center justify-center cursor-pointer ${
                                      isSelected
                                        ? "bg-[#E30613] text-white"
                                        : "bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    }`}
                                  >
                                    {day.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Start and end hours */}
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">Начало:</span>
                              <input
                                type="time"
                                value={rule.startTime}
                                onChange={(e) => updateRuleTimes(rule.id, "startTime", e.target.value)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">Конец:</span>
                              <input
                                type="time"
                                value={rule.endTime}
                                onChange={(e) => updateRuleTimes(rule.id, "endTime", e.target.value)}
                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-mono text-zinc-900 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Row: Face ID (Appended if active) */}
                {hasFaceRec && role === "resident" && (
                  <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-4">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        Автооткрытие по лицу
                      </label>
                      <button
                        type="button"
                        onClick={() => setUseFaceRec(!useFaceRec)}
                        className={`flex items-center gap-1 text-[11px] font-bold transition-colors cursor-pointer ${useFaceRec ? "text-emerald-500" : "text-zinc-400"}`}
                      >
                        {useFaceRec ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {useFaceRec && (
                      <div className="flex items-center gap-4 mt-2">
                        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden relative group">
                          {facePhotoBase64 || hasFacePhoto ? (
                            <>
                              <img src={facePhotoBase64 || (editingPerson ? `/api/plugins/face-id/image/${editingPerson.id}` : '')} alt="Face preview" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => { setFacePhotoBase64(""); setHasFacePhoto(false); }}
                                  className="text-white bg-red-500/80 rounded-full p-1 cursor-pointer hover:bg-red-500"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <Camera className="w-6 h-6 text-zinc-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            id="face-upload"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setFacePhotoBase64(ev.target?.result as string);
                                  setHasFacePhoto(true);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label
                            htmlFor="face-upload"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white text-xs font-bold rounded-xl transition cursor-pointer"
                          >
                            <ImagePlus className="w-4 h-4" />
                            <span>Выбрать фото</span>
                          </label>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                            Для корректной работы лицо должно быть хорошо освещено и смотреть прямо в камеру.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSavePerson}
                  className="px-6 py-2 bg-[#E30613] hover:bg-[#c20510] text-white text-xs font-black rounded-full transition shadow-md shadow-[#E30613]/15 cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Сохранить</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {personToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] p-6 max-w-sm w-full shadow-2xl relative overflow-hidden space-y-4"
            >
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider text-center">
                  Подтвердите удаление
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed text-center">
                  Вы уверены, что хотите удалить <strong>{personToDelete.name}</strong> и все связанные расписания автооткрытия? Это действие нельзя будет отменить.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPersonToDelete(null)}
                  className="flex-1 py-2.5 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800 transition cursor-pointer text-center"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePerson}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-full transition shadow-md shadow-red-600/15 cursor-pointer text-center"
                >
                  Удалить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
