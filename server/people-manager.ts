import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "./config.js";
import { getSettings } from "./settings-manager.js";
import { broadcastAutoOpenStatusChanged } from "./ws-manager.js";

import type { Person, ScheduleRule } from "../shared/types.js";
export type { Person, ScheduleRule };

const PEOPLE_FILE = path.join(DATA_DIR, "people.json");

const defaultPeople: Person[] = [
  {
    id: "user",
    name: "Я",
    role: "resident",
    enabled: true,
    schedules: [
      {
        id: "user-s1",
        days: [1, 2, 3, 4],
        startTime: "18:00",
        endTime: "19:00"
      },
      {
        id: "user-s2",
        days: [5],
        startTime: "17:00",
        endTime: "18:00"
      }
    ]
  },
  {
    id: "girl",
    name: "Девушка",
    role: "resident",
    enabled: true,
    schedules: [
      {
        id: "girl-s1",
        days: [1, 3, 5],
        startTime: "18:00",
        endTime: "19:00"
      },
      {
        id: "girl-s2",
        days: [2, 4],
        startTime: "21:15",
        endTime: "22:15"
      }
    ]
  },
  {
    id: "courier",
    name: "Курьер",
    role: "courier",
    enabled: false,
    maxOpens: 1,
    opensRemaining: 1,
    schedules: [
      {
        id: "courier-s1",
        days: [1, 2, 3, 4, 5, 6, 0],
        startTime: "08:00",
        endTime: "23:00"
      }
    ]
  }
];

export function getPeople(): Person[] {
  try {
    if (!fs.existsSync(PEOPLE_FILE)) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(PEOPLE_FILE, JSON.stringify(defaultPeople, null, 2), "utf-8");
      return defaultPeople;
    }
    const content = fs.readFileSync(PEOPLE_FILE, "utf-8");
    const people: Person[] = JSON.parse(content);

    // Auto-clean expired temporary guest/couriers and reset daily limits
    const now = Date.now();
    const todayStr = getServerDateString(new Date(now));
    let hasChanges = false;
    const filtered = people.filter(p => {
      if (p.id.startsWith("temp-") && p.expiresAt && now > p.expiresAt) {
        hasChanges = true;
        return false;
      }
      
      // Reset daily limits for guests/couriers
      if (p.role !== "resident" && p.maxOpens !== undefined && p.maxOpens !== null) {
        if (p.lastOpenedDate && p.lastOpenedDate !== todayStr && p.opensRemaining !== p.maxOpens) {
          p.opensRemaining = p.maxOpens;
          hasChanges = true;
        }
        // Backward compatibility for existing data without lastOpenedDate
        if (!p.lastOpenedDate && p.opensRemaining !== p.maxOpens) {
           p.opensRemaining = p.maxOpens;
           hasChanges = true;
        }
      }
      
      return true;
    });

    if (hasChanges) {
      try {
        fs.writeFileSync(PEOPLE_FILE, JSON.stringify(filtered, null, 2), "utf-8");
      } catch (e) {
        console.error("Failed to save auto-cleaned people schedules", e);
      }
      return filtered;
    }

    return people;
  } catch (err) {
    console.error("Failed to read people schedules", err);
    return defaultPeople;
  }
}

export function savePeople(people: Person[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const cleanPeople = people.map(p => {
      const { uiExtensions, ...rest } = p as any;
      return rest;
    });
    fs.writeFileSync(PEOPLE_FILE, JSON.stringify(cleanPeople, null, 2), "utf-8");
    broadcastAutoOpenStatusChanged();
  } catch (err) {
    console.error("Failed to save people schedules", err);
  }
}

export function getServerTime(now: Date = new Date()) {
  const { timezone } = getSettings();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || "Europe/Moscow",
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value;
  
  const days: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6
  };
  
  let hours = parseInt(getPart('hour') || '0', 10);
  if (hours === 24) hours = 0; // en-US sometimes returns 24 for midnight if hour12: false

  return {
    day: days[getPart('weekday')!] || 0,
    hours,
    minutes: parseInt(getPart('minute') || '0', 10)
  };
}

export function getServerDateString(now: Date = new Date()): string {
  const { timezone } = getSettings();
  const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA produces YYYY-MM-DD
    timeZone: timezone || "Europe/Moscow",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

export function isScheduleActive(person: Person, now: Date = new Date()): boolean {
  if (!person.enabled) return false;

  // Check guest/courier limit
  if (person.role !== "resident") {
    if (person.opensRemaining !== undefined && person.opensRemaining !== null && person.opensRemaining <= 0) {
      return false;
    }
  }

  const { day, hours, minutes } = getServerTime(now);
  const currentMinutesSinceMidnight = hours * 60 + minutes;
  const prevDay = (day - 1 + 7) % 7;

  for (const rule of person.schedules) {
    const [startH, startM] = rule.startTime.split(":").map(Number);
    const [endH, endM] = rule.endTime.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const wrapsMidnight = startMinutes > endMinutes;

    if (rule.days.includes(day)) {
      if (!wrapsMidnight) {
        if (currentMinutesSinceMidnight >= startMinutes && currentMinutesSinceMidnight <= endMinutes) {
          return true;
        }
      } else {
        // e.g. 23:00 to 01:00, it is currently 23:30 on the start day
        if (currentMinutesSinceMidnight >= startMinutes) {
          return true;
        }
      }
    }
    
    if (wrapsMidnight && rule.days.includes(prevDay)) {
      // e.g. 23:00 to 01:00, it is currently 00:30 on the next day
      if (currentMinutesSinceMidnight <= endMinutes) {
        return true;
      }
    }
  }

  return false;
}

import { pluginManager } from "./plugin-manager.js";

/**
 * Evaluates all auto-open rules including Schedule and Plugin hooks (2FA logic).
 */
export async function checkAutoOpenRules(deviceId?: number): Promise<{ active: boolean; person?: Person; message?: string }> {
  const people = getPeople();
  const now = new Date();

  // Sort people so residents are checked before guests/couriers
  const sortedPeople = [...people].sort((a, b) => (a.role === "resident" ? -1 : 1) - (b.role === "resident" ? -1 : 1));

  for (const person of sortedPeople) {
    if (!person.enabled) continue;

    const requiresSchedule = person.useSchedule !== false;
    
    // Check if any plugin/module settings are enabled and functional (not in error status) for this person
    let requiresPlugin = false;
    if (person.pluginSettings) {
      try {
        const { getModules } = await import("./modules-manager.js");
        const modules = getModules();
        const activePlugins = Object.entries(person.pluginSettings).filter(([capName, isEnabled]) => {
          if (!isEnabled) return false;
          // Find the module that registers this capability
          const owningModule = modules.find(m => m.capabilities && m.capabilities[capName]);
          if (owningModule) {
            // Если модуль офлайн — не блокируем открытие по расписанию (graceful degradation).
            // Дверь откроется только по расписанию, как если бы плагина не было.
            if (owningModule.status === "offline") {
              return false;
            }
            const entityStatus = owningModule.entityStatuses?.[`person_${person.id}`];
            if (entityStatus && entityStatus.status === "error") {
              return false; // Skip plugins that are in error state
            }
          }
          return true;
        });
        requiresPlugin = activePlugins.length > 0;
      } catch (err) {
        console.error("Error evaluating plugin readiness status in checkAutoOpenRules:", err);
        requiresPlugin = Object.values(person.pluginSettings).some(val => val === true);
      }
    }

    // Fast fail if both are disabled
    if (!requiresSchedule && !requiresPlugin) {
      continue; 
    }

    // 1. Check Schedule
    if (requiresSchedule && !isScheduleActive(person, now)) {
      continue; // Time is outside allowed interval
    }

    // 2. Check Plugins (Face ID)
    if (requiresPlugin && deviceId) {
      const pluginResult = await pluginManager.executeAutoOpenHooks(person, deviceId);
      if (!pluginResult) {
         continue; // Plugin denied or couldn't recognize
      }
    }

    // If we reach here, the person passed all required checks (2FA succeeded)
    if (person.role !== "resident" && person.opensRemaining !== undefined && person.opensRemaining !== null) {
      person.opensRemaining = Math.max(0, person.opensRemaining - 1);
      person.lastOpenedDate = getServerDateString(now);
      savePeople(people);
    }

    return {
      active: true,
      person,
      message: `Авто-открытие: ${person.name} (${requiresSchedule && requiresPlugin ? 'Расписание + Лицо' : (requiresPlugin ? 'Лицо' : 'Расписание')})`
    };
  }

  return { active: false };
}

function formatTimeHHMM_MSK(date: Date): string {
  const { hours, minutes } = getServerTime(date);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function addTemporaryAutoOpenPerson(deviceId: number, maxOpens: number | null, durationMinutes: number, explicitRole?: "guest" | "courier") {
  const people = getPeople();
  const tempId = `temp-${deviceId}`;
  const now = Date.now();
  const duration = durationMinutes || 60;
  
  // Format precisely to MSK timezone with exactly matching duration
  const startStr = formatTimeHHMM_MSK(new Date(now));
  const endStr = formatTimeHHMM_MSK(new Date(now + duration * 60 * 1000));

  const role = explicitRole || (maxOpens === 1 ? "courier" : "guest");
  let name = "";
  if (role === "guest") {
    name = maxOpens === 1 ? "Быстрый доступ (Гость)" : `Быстрый доступ (Гости${maxOpens ? ` x${maxOpens}` : ""})`;
  } else {
    name = "Быстрый доступ (Курьер)";
  }

  const tempPerson: Person = {
    id: tempId,
    name: name,
    role: role,
    enabled: true,
    maxOpens: maxOpens,
    opensRemaining: maxOpens,
    expiresAt: now + duration * 60 * 1000,
    schedules: [
      {
        id: `rule-${now}`,
        days: [0, 1, 2, 3, 4, 5, 6],
        startTime: startStr,
        endTime: endStr
      }
    ]
  };

  const existingIdx = people.findIndex(p => p.id === tempId);
  if (existingIdx !== -1) {
    people[existingIdx] = tempPerson;
  } else {
    people.push(tempPerson);
  }
  savePeople(people);
}

export function removeTemporaryAutoOpenPerson(deviceId: number) {
  const people = getPeople();
  const tempId = `temp-${deviceId}`;
  const filtered = people.filter(p => p.id !== tempId);
  savePeople(filtered);
}

