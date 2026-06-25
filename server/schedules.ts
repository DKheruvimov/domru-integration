import fs from "fs";
import path from "path";
import { DATA_DIR } from "./config.js";
import { v4 as uuidv4 } from "uuid";

export interface RecurringSchedule {
  id: string;
  deviceId: number;
  login: string;
  name: string;
  daysOfWeek: number[]; // 0=Sun, 1=Mon...
  timeStart: string; // HH:MM
  timeEnd: string; // HH:MM
  maxOpensPerDay: number;
  usageHistory: Record<string, number>; // "YYYY-MM-DD" -> count
}

const SCHEDULES_FILE = path.join(DATA_DIR, "schedules.json");

let schedules: RecurringSchedule[] = [];

export function loadSchedules() {
  try {
    if (fs.existsSync(SCHEDULES_FILE)) {
      schedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[Schedules] Failed to load", e);
  }
}

export function saveSchedules() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
  } catch (e) {
    console.error("[Schedules] Failed to save", e);
  }
}

export function getSchedules() {
  return schedules;
}

export function addSchedule(s: Omit<RecurringSchedule, "id" | "usageHistory">) {
  const newSchedule: RecurringSchedule = {
    ...s,
    id: uuidv4(),
    usageHistory: {}
  };
  schedules.push(newSchedule);
  saveSchedules();
  return newSchedule;
}

export function deleteSchedule(id: string) {
  schedules = schedules.filter(s => s.id !== id);
  saveSchedules();
}

export function updateSchedule(id: string, updates: Partial<RecurringSchedule>) {
  const s = schedules.find(s => s.id === id);
  if (s) {
    Object.assign(s, updates);
    saveSchedules();
    return s;
  }
  return null;
}
