import fs from "fs";
import path from "path";
import { DATA_DIR } from "./config.js";

export interface AppSettings {
  autoOpenDelayResidentMs: number;
  autoOpenDelayGuestMs: number;
  customDomain?: string;
  timezone: string;
}

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const defaultSettings: AppSettings = {
  autoOpenDelayResidentMs: 0,
  autoOpenDelayGuestMs: 3000,
  customDomain: "",
  timezone: "Europe/Moscow",
};

export function getSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), "utf-8");
      return defaultSettings;
    }
    const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
    const parsed = JSON.parse(content);
    // Merge with defaults to ensure new fields are populated
    return { ...defaultSettings, ...parsed };
  } catch (err) {
    console.error("Failed to read settings", err);
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save settings", err);
  }
}
