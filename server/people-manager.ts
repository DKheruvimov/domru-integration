import fs from "fs";
import path from "path";
import { DATA_DIR } from "./config.js";

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

    // Auto-clean expired temporary guest/couriers
    const now = Date.now();
    let hasChanges = false;
    const filtered = people.filter(p => {
      if (p.id.startsWith("temp-") && p.expiresAt && now > p.expiresAt) {
        hasChanges = true;
        return false;
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

  for (const rule of person.schedules) {
    if (rule.days.includes(day)) {
      const [startH, startM] = rule.startTime.split(":").map(Number);
      const [endH, endM] = rule.endTime.split(":").map(Number);
      
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (currentMinutesSinceMidnight >= startMinutes && currentMinutesSinceMidnight <= endMinutes) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if any person has an active schedule right now.
 * Resident schedules are checked first, then guest/courier.
 * If a resident schedule is active, return that resident without decrementing counters.
 * If a guest/courier is active, return that guest/courier and decrement remaining count.
 */
export function checkActiveSchedules(): { active: boolean; person?: Person; message?: string } {
  const people = getPeople();
  const now = new Date();

  // 1. Check Residents first
  const activeResident = people.find(p => p.role === "resident" && isScheduleActive(p, now));
  if (activeResident) {
    return {
      active: true,
      person: activeResident,
      message: `Авто-открытие по расписанию резидента: ${activeResident.name}`
    };
  }

  // 2. Check Guest/Couriers
  const activeGuestIndex = people.findIndex(p => p.role !== "resident" && isScheduleActive(p, now));
  if (activeGuestIndex !== -1) {
    const activeGuest = people[activeGuestIndex];
    if (activeGuest.opensRemaining !== undefined && activeGuest.opensRemaining !== null) {
      activeGuest.opensRemaining = Math.max(0, activeGuest.opensRemaining - 1);
    }
    savePeople(people);
    return {
      active: true,
      person: activeGuest,
      message: `Авто-открытие по гостевому расписанию: ${activeGuest.name}. Осталось открытий: ${activeGuest.opensRemaining ?? "безлимитно"}`
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

export function addTemporaryAutoOpenPerson(deviceId: number, maxOpens: number | null, durationMinutes: number) {
  const people = getPeople();
  const tempId = `temp-${deviceId}`;
  const now = Date.now();
  const duration = durationMinutes || 60;
  
  // Format precisely to MSK timezone with exactly matching duration
  const startStr = formatTimeHHMM_MSK(new Date(now));
  const endStr = formatTimeHHMM_MSK(new Date(now + duration * 60 * 1000));

  const tempPerson: Person = {
    id: tempId,
    name: maxOpens === 1 ? "Быстрый доступ (Курьер)" : `Быстрый доступ (Гости${maxOpens ? ` x${maxOpens}` : ""})`,
    role: maxOpens === 1 ? "courier" : "guest",
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

