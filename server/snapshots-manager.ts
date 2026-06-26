import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "./config.js";

export interface SipSnapshotEntry {
  id: string;
  timestamp: number;
  login: string;
  placeId: number;
  deviceId: number;
  fileName: string;
}

const SNAPSHOTS_DIR = path.join(DATA_DIR, "snapshots");
const INDEX_FILE = path.join(DATA_DIR, "snapshots.json");

// 1x1 grey pixel valid JPEG as fallback
const FALLBACK_JPEG_BASE64 = 
  "/9j/4AAQSkZJRgABAQEASABIAAD/4QA6RXhpZgAATU0AKgAAAAgAAgESAAMAAAABAAEAAIdpAAQAAAABAAAAJgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

function ensureSnapshotsDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
}

export function loadSnapshotsIndex(): SipSnapshotEntry[] {
  ensureSnapshotsDir();
  if (!fs.existsSync(INDEX_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(INDEX_FILE, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error("[Snapshots] Failed to load index:", err);
    return [];
  }
}

export function saveSnapshotsIndex(entries: SipSnapshotEntry[]) {
  ensureSnapshotsDir();
  try {
    fs.writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch (err) {
    console.error("[Snapshots] Failed to save index:", err);
  }
}

/**
 * Saves a snapshot image buffer to disk and registers it in the index.
 * Cleans up snapshots older than 30 days afterwards.
 */
export async function addSnapshot(
  login: string,
  placeId: number,
  deviceId: number,
  imageBuffer: Uint8Array
): Promise<SipSnapshotEntry> {
  ensureSnapshotsDir();
  
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  const fileName = `${timestamp}_${deviceId}_${id.substring(0, 8)}.jpg`;
  const filePath = path.join(SNAPSHOTS_DIR, fileName);

  try {
    fs.writeFileSync(filePath, Buffer.from(imageBuffer));
    console.log(`[Snapshots] Saved snapshot to ${filePath} (${imageBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[Snapshots] Failed to write image file:`, err);
    throw err;
  }

  const entries = loadSnapshotsIndex();
  const newEntry: SipSnapshotEntry = {
    id,
    timestamp,
    login,
    placeId,
    deviceId,
    fileName,
  };

  entries.push(newEntry);
  saveSnapshotsIndex(entries);

  // Trigger background cleanup asynchronously
  cleanupOldSnapshots().catch((err) => {
    console.error("[Snapshots] Cleanup failed:", err);
  });

  return newEntry;
}

/**
 * Saves a mock snapshot for testing and development (demo mode).
 */
export async function addMockSnapshot(login: string, placeId: number, deviceId: number): Promise<SipSnapshotEntry> {
  const buf = Buffer.from(FALLBACK_JPEG_BASE64, "base64");
  return addSnapshot(login, placeId, deviceId, new Uint8Array(buf));
}

/**
 * Cleans up snapshots older than 30 days (1 month).
 */
export async function cleanupOldSnapshots(): Promise<void> {
  ensureSnapshotsDir();
  const entries = loadSnapshotsIndex();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const validEntries: SipSnapshotEntry[] = [];
  const expiredEntries: SipSnapshotEntry[] = [];

  for (const entry of entries) {
    if (entry.timestamp >= thirtyDaysAgo) {
      validEntries.push(entry);
    } else {
      expiredEntries.push(entry);
    }
  }

  if (expiredEntries.length === 0) {
    return;
  }

  console.log(`[Snapshots] Cleaning up ${expiredEntries.length} expired snapshots...`);

  for (const entry of expiredEntries) {
    const filePath = path.join(SNAPSHOTS_DIR, entry.fileName);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Snapshots] Deleted expired snapshot file: ${entry.fileName}`);
      }
    } catch (err) {
      console.error(`[Snapshots] Failed to delete file ${entry.fileName}:`, err);
    }
  }

  saveSnapshotsIndex(validEntries);
}

/**
 * Finds the closest snapshot for a given deviceId and event timestamp.
 * Max allowed difference: 45 seconds.
 */
export function findSnapshotForEvent(deviceId: number, eventTimeMs: number): SipSnapshotEntry | null {
  const entries = loadSnapshotsIndex();
  const maxDiffMs = 45 * 1000; // 45 seconds tolerance

  let bestMatch: SipSnapshotEntry | null = null;
  let smallestDiff = Infinity;

  for (const entry of entries) {
    if (entry.deviceId === deviceId) {
      const diff = Math.abs(entry.timestamp - eventTimeMs);
      if (diff <= maxDiffMs && diff < smallestDiff) {
        smallestDiff = diff;
        bestMatch = entry;
      }
    }
  }

  return bestMatch;
}

export function getSnapshotPath(fileName: string): string {
  // Prevent directory traversal attacks
  const cleanFileName = path.basename(fileName);
  return path.join(SNAPSHOTS_DIR, cleanFileName);
}
