import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_FILE = path.join(process.cwd(), "data", "modules.json");

import type { CapabilityConfig } from "../shared/types.js";

export interface ExternalModule {
  id: string;
  name: string;
  token: string;
  createdAt: number;
  capabilities?: Record<string, CapabilityConfig>;
}

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getModules(): ExternalModule[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading modules.json:", error);
    return [];
  }
}

export function saveModules(modules: ExternalModule[]) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(modules, null, 2), "utf-8");
}

export function createModule(name: string): ExternalModule {
  const modules = getModules();
  
  const id = crypto.randomUUID();
  // Generate a secure token (e.g. mod_abc123...)
  const token = "mod_" + crypto.randomBytes(24).toString("hex");
  
  const newModule: ExternalModule = {
    id,
    name,
    token,
    createdAt: Date.now()
  };
  
  modules.push(newModule);
  saveModules(modules);
  
  return newModule;
}

export function deleteModule(id: string): boolean {
  let modules = getModules();
  const initialLength = modules.length;
  modules = modules.filter(m => m.id !== id);
  
  if (modules.length !== initialLength) {
    saveModules(modules);
    return true;
  }
  return false;
}

export function validateModuleToken(token: string): ExternalModule | undefined {
  if (!token) return undefined;
  const modules = getModules();
  return modules.find(m => m.token === token);
}

// Capabilities
export function registerModuleCapability(moduleId: string, capabilityName: string, config: CapabilityConfig) {
  const modules = getModules();
  const mod = modules.find(m => m.id === moduleId);
  if (mod) {
    if (!mod.capabilities) mod.capabilities = {};
    mod.capabilities[capabilityName] = config;
    saveModules(modules);
  }
}

export function getAllModuleCapabilities(): Record<string, CapabilityConfig> {
  const modules = getModules();
  let allCaps: Record<string, CapabilityConfig> = {};
  for (const mod of modules) {
    if (mod.capabilities) {
      allCaps = { ...allCaps, ...mod.capabilities };
    }
  }
  return allCaps;
}

// Storage
const MODULES_STORAGE_DIR = path.join(process.cwd(), "data", "modules-storage");

function ensureStorageDir() {
  if (!fs.existsSync(MODULES_STORAGE_DIR)) {
    fs.mkdirSync(MODULES_STORAGE_DIR, { recursive: true });
  }
}

export async function readModuleStorage(moduleId: string): Promise<Record<string, any>> {
  ensureStorageDir();
  const file = path.join(MODULES_STORAGE_DIR, `${moduleId}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    const data = await fs.promises.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

export async function writeModuleStorage(moduleId: string, data: Record<string, any>) {
  ensureStorageDir();
  const file = path.join(MODULES_STORAGE_DIR, `${moduleId}.json`);
  await fs.promises.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export async function getModuleStorageValue(moduleId: string, key: string) {
  const data = await readModuleStorage(moduleId);
  return data[key];
}

export async function setModuleStorageValue(moduleId: string, key: string, value: any) {
  const data = await readModuleStorage(moduleId);
  data[key] = value;
  await writeModuleStorage(moduleId, data);
}

export async function deleteModuleStorageValue(moduleId: string, key: string) {
  const data = await readModuleStorage(moduleId);
  delete data[key];
  await writeModuleStorage(moduleId, data);
}

// UI Enrichment
export async function enrichPeopleWithModuleExtensions(people: any[]): Promise<any[]> {
  const allCaps = getAllModuleCapabilities();
  const modules = getModules();
  
  // Pre-load storage keys for active modules to avoid sequential disk reads
  const moduleKeys: Record<string, string[]> = {};
  for (const m of modules) {
    if (m.capabilities) {
      const data = await readModuleStorage(m.id);
      moduleKeys[m.id] = Object.keys(data);
    }
  }

  return people.map(p => {
    const uiExtensions: any = { badges: [], customBlocks: [] };
    let hasExtensions = false;

    // Check every registered capability
    for (const m of modules) {
      if (!m.capabilities) continue;
      for (const [capName, config] of Object.entries(m.capabilities)) {
        const isEnabled = !!(p.pluginSettings && p.pluginSettings[capName]);
        const keys = moduleKeys[m.id] || [];
        const hasData = keys.includes(p.id);

        if (isEnabled) {
          uiExtensions.badges.push({
            label: config.label || capName,
            color: hasData ? "success" : "warning"
          });
          hasExtensions = true;
        }

        if (hasData && config.mediaEndpoint) {
          // If the capability has media and the person has data, show it as avatar
          // Using the new generic /api/modules/storage route
          uiExtensions.avatarUrl = `/api/modules/storage/${m.id}/${p.id}`;
          hasExtensions = true;
        }
      }
    }

    return {
      ...p,
      uiExtensions: hasExtensions ? uiExtensions : undefined
    };
  });
}
