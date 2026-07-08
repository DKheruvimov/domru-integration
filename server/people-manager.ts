import fs from "fs";
import path from "path";
import { DATA_DIR } from "./config.js";
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
    const todayStr = getMskDateString(new Date(now));
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
    fs.writeFileSync(PEOPLE_FILE, JSON.stringify(people, null, 2), "utf-8");
    broadcastAutoOpenStatusChanged();
  } catch (err) {
    console.error("Failed to save people schedules", err);
  }
}

export function getMskTime(now: Date = new Date()) {
  // Moscow is UTC+3. This shifts the UTC time by 3 hours so that UTC methods return MSK values.
  const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return {
    day: mskTime.getUTCDay(),
    hours: mskTime.getUTCHours(),
    minutes: mskTime.getUTCMinutes()
  };
}

export function getMskDateString(now: Date = new Date()): string {
  const mskTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return mskTime.toISOString().split("T")[0]; // Returns "YYYY-MM-DD"
}

export function isScheduleActive(person: Person, now: Date = new Date()): boolean {
  if (!person.enabled) return false;

  // Check guest/courier limit
  if (person.role !== "resident") {
    if (person.opensRemaining !== undefined && person.opensRemaining !== null && person.opensRemaining <= 0) {
      return false;
    }
  }

  const { day, hours, minutes } = getMskTime(now);
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
    // For now we assume any true value in pluginSettings means it requires plugin validation.
    // In a real system, you'd iterate over plugins.
    const requiresPlugin = person.pluginSettings?.FACE_RECOGNITION === true;

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
      person.lastOpenedDate = getMskDateString(now);
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
  const { hours, minutes } = getMskTime(date);
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

