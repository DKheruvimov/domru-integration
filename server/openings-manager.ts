import fs from "fs";
import path from "path";
import { DATA_DIR } from "./config.js";

export interface DoorOpeningRecord {
  id: string;
  timestamp: number;
  deviceId: number;
  type: "manual" | "auto";
  details: string; // e.g. "По расписанию: Курьер", "Вручную из приложения"
}

const OPENINGS_FILE = path.join(DATA_DIR, "openings.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadOpenings(): DoorOpeningRecord[] {
  ensureDir();
  if (!fs.existsSync(OPENINGS_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(OPENINGS_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("[Openings] Failed to load:", err);
    return [];
  }
}

export function saveOpenings(entries: DoorOpeningRecord[]) {
  ensureDir();
  try {
    fs.writeFileSync(OPENINGS_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch (err) {
    console.error("[Openings] Failed to save:", err);
  }
}

export function recordDoorOpening(deviceId: number, type: "manual" | "auto", details: string) {
  const entries = loadOpenings();
  const timestamp = Date.now();
  const id = `${timestamp}_${Math.random().toString(36).substring(2, 6)}`;
  
  const newEntry: DoorOpeningRecord = {
    id,
    timestamp,
    deviceId,
    type,
    details,
  };

  entries.push(newEntry);

  // Keep records for 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filtered = entries.filter(e => e.timestamp >= thirtyDaysAgo);

  saveOpenings(filtered);
  console.log(`[Openings] Recorded door open: Device ${deviceId}, type: ${type}, details: ${details}`);
}

export function getOpeningByOurService(eventTimeMs: number): DoorOpeningRecord | null {
  const entries = loadOpenings();
  const maxDiffMs = 5 * 60 * 1000; // 5 minutes tolerance

  let bestMatch: DoorOpeningRecord | null = null;
  let smallestDiff = Infinity;

  for (const entry of entries) {
    const diff = Math.abs(entry.timestamp - eventTimeMs);
    if (diff <= maxDiffMs && diff < smallestDiff) {
      smallestDiff = diff;
      bestMatch = entry;
    }
  }

  return bestMatch;
}
