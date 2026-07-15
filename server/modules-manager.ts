import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getPeople, savePeople } from "./people-manager.js";

const DATA_FILE = path.join(process.cwd(), "data", "modules.json");

import type { CapabilityConfig } from "../shared/types.js";

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

export interface EntityStatus {
  entityType: string;
  entityId: string;
  status: "processing" | "success" | "error" | "disabled";
  message?: string;
  updatedAt: number;
}

export interface ExternalModule {
  id: string;
  name: string;
  token: string;
  createdAt: number;
  isClaimed?: boolean;
  isEnabled?: boolean; // defaults to true
  capabilities?: Record<string, CapabilityConfig>;
  connection?: {
    type: "websocket" | "webhook" | "long_polling";
    webhookUrl?: string;
  };
  configSchema?: {
    instruction?: string;
    fields: ModuleConfigField[];
  };
  configValues?: Record<string, any>;
  
  // Explicit Dynamic Status (in-memory, not persisted in DB)
  status?: "offline" | "warning" | "error" | "online";
  statusMessage?: string;
  
  // Entity Status Reporting
  entityStatuses?: Record<string, EntityStatus>; // key: `${entityType}_${entityId}`
}

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// In-memory statuses
const moduleStatuses = new Map<string, { status: "offline" | "warning" | "error" | "online", message?: string }>();

export function setModuleStatus(moduleId: string, status: "offline" | "warning" | "error" | "online", message?: string) {
  moduleStatuses.set(moduleId, { status, message });
  
  // Persist the status so webhooks remember their state across restarts
  const modules = getModules(); // getModules will automatically inject the new status from the memory map
  saveModules(modules);
}

export function setModuleEntityStatus(moduleId: string, entityType: string, entityId: string, status: "processing" | "success" | "error" | "disabled", message?: string) {
  const modules = getModules();
  const mod = modules.find(m => m.id === moduleId);
  if (mod) {
    if (!mod.entityStatuses) {
      mod.entityStatuses = {};
    }
    const key = `${entityType}_${entityId}`;
    mod.entityStatuses[key] = {
      entityType,
      entityId,
      status,
      message,
      updatedAt: Date.now()
    };
    saveModules(modules);
  }
}

export function deleteModuleEntityStatus(moduleId: string, entityType: string, entityId: string) {
  const modules = getModules();
  const mod = modules.find(m => m.id === moduleId);
  if (mod && mod.entityStatuses) {
    const key = `${entityType}_${entityId}`;
    delete mod.entityStatuses[key];
    saveModules(modules);
  }
}

export function getModules(): ExternalModule[] {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed: ExternalModule[] = JSON.parse(content);
    
    let anyPruned = false;
    let people: any[] = [];
    try {
      people = getPeople();
    } catch (e) {
      // Prevent crash during circular imports or startup
    }

    const processed = parsed.map(m => {
      // Clean up invalid entity statuses (e.g. deleted people or unsupported roles)
      if (m.entityStatuses && people.length > 0) {
        for (const key of Object.keys(m.entityStatuses)) {
          if (key.startsWith("person_")) {
            const pId = key.substring(7);
            const p = people.find(item => item.id === pId);
            if (!p) {
              delete m.entityStatuses[key];
              anyPruned = true;
            } else if (m.capabilities) {
              const supportsRole = Object.values(m.capabilities).some(cap => !cap.supportedRoles || cap.supportedRoles.includes(p.role));
              if (!supportsRole) {
                delete m.entityStatuses[key];
                anyPruned = true;
              }
            }
          }
        }
      }

      // Automatically maintain entity statuses for disabled/unconfigured people
      if (people.length > 0 && m.capabilities && m.isEnabled !== false) {
        m.entityStatuses = m.entityStatuses || {};
        for (const p of people) {
          // Find all capabilities of this module that support the person's role
          const supportedCaps = Object.entries(m.capabilities).filter(([_, cap]: [string, any]) => {
            return !cap.supportedRoles || cap.supportedRoles.includes(p.role);
          });
          
          if (supportedCaps.length > 0) {
            const key = `person_${p.id}`;
            const current = m.entityStatuses[key];
            
            if (p.enabled === false) {
              if (!current || current.status !== "disabled" || current.message !== "Резидент отключен") {
                m.entityStatuses[key] = {
                  entityType: "person",
                  entityId: p.id,
                  status: "disabled",
                  message: "Резидент отключен",
                  updatedAt: Date.now()
                };
                anyPruned = true;
              }
            } else {
              // Check if any of the supported capabilities are enabled for this person
              const hasEnabledCap = supportedCaps.some(([capName]) => p.pluginSettings?.[capName] === true);
              if (!hasEnabledCap) {
                const firstCap = supportedCaps[0];
                const capLabel = (firstCap[1] as any).label || firstCap[0];
                const capMsg = capLabel.toLowerCase().includes("face") ? "Распознавание лиц выключено" : `${capLabel} выключено`;
                
                if (!current || current.status !== "disabled" || current.message !== capMsg) {
                  m.entityStatuses[key] = {
                    entityType: "person",
                    entityId: p.id,
                    status: "disabled",
                    message: capMsg,
                    updatedAt: Date.now()
                  };
                  anyPruned = true;
                }
              } else {
                // It is enabled! If it was "disabled" previously, remove it so it starts fresh for the module
                if (current && current.status === "disabled") {
                  delete m.entityStatuses[key];
                  anyPruned = true;
                }
              }
            }
          }
        }
      }

      const mem = moduleStatuses.get(m.id);
      if (mem) {
        m.status = mem.status;
        m.statusMessage = mem.message;
      } else {
        // Only reset to offline for stateful connections (websockets).
        // Webhooks are stateless, so their last saved status remains valid.
        if (m.connection?.type !== "webhook") {
          m.status = "offline"; 
          m.statusMessage = undefined;
        }
      }
      return m;
    });

    if (anyPruned) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(processed, null, 2), "utf-8");
    }

    return processed;
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
  const mod = modules.find(m => m.id === id);
  if (!mod) return false;

  // 1. Collect all capability names associated with this module
  const capNames = mod.capabilities ? Object.keys(mod.capabilities) : [];

  // 2. Completely delete the module's storage file from disk
  const storageFile = path.join(MODULES_STORAGE_DIR, `${id}.json`);
  if (fs.existsSync(storageFile)) {
    try {
      fs.unlinkSync(storageFile);
    } catch (err) {
      console.error(`Error deleting storage file on delete for module ${id}:`, err);
    }
  }

  // 3. Reset people's plugin settings for these capabilities
  if (capNames.length > 0) {
    try {
      const people = getPeople();
      let peopleChanged = false;
      for (const person of people) {
        if (person.pluginSettings) {
          for (const capName of capNames) {
            if (capName in person.pluginSettings) {
              delete person.pluginSettings[capName];
              peopleChanged = true;
            }
          }
        }
      }
      if (peopleChanged) {
        savePeople(people);
      }
    } catch (err) {
      console.error(`Error resetting people plugin settings on module delete for ${id}:`, err);
    }
  }

  // 4. Remove in-memory status
  moduleStatuses.delete(id);

  // 5. Save remaining modules list
  modules = modules.filter(m => m.id !== id);
  saveModules(modules);

  return true;
}

export function validateModuleToken(token: string, allowDisabled: boolean = false): ExternalModule | undefined {
  if (!token) return undefined;
  const modules = getModules();
  const mod = modules.find(m => m.token === token);
  if (mod && mod.isEnabled === false && !allowDisabled) {
    return undefined;
  }
  return mod;
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
    if (mod.isEnabled !== false && mod.capabilities) {
      allCaps = { ...allCaps, ...mod.capabilities };
    }
  }
  return allCaps;
}

// Connection Configuration
export function setModuleConnection(moduleId: string, type: "websocket" | "webhook" | "long_polling", webhookUrl?: string) {
  const modules = getModules();
  const mod = modules.find(m => m.id === moduleId);
  if (mod) {
    mod.connection = { type, webhookUrl };
    saveModules(modules);
  }
}

// UI Configuration Schema
export function setModuleSchema(moduleId: string, instruction: string | undefined, fields: ModuleConfigField[]) {
  const modules = getModules();
  const mod = modules.find(m => m.id === moduleId);
  if (mod) {
    mod.configSchema = { instruction, fields };
    saveModules(modules);
  }
}

export function setModuleConfigValues(moduleId: string, values: Record<string, any>) {
  const modules = getModules();
  const mod = modules.find(m => m.id === moduleId);
  if (mod) {
    mod.configValues = values;
    saveModules(modules);
  }
}

export function resetModuleIntegration(moduleId: string): boolean {
  const modules = getModules();
  const mod = modules.find(m => m.id === moduleId);
  if (mod) {
    // 1. Collect all capability names associated with this module before deleting them
    const capNames = mod.capabilities ? Object.keys(mod.capabilities) : [];

    // 2. Clear module configuration, config schema, capabilities, and statuses
    mod.configValues = {};
    delete mod.configSchema;
    delete mod.capabilities;
    delete mod.entityStatuses;
    delete mod.isClaimed;
    
    // Reset in-memory status
    moduleStatuses.set(moduleId, { status: "offline", message: undefined });
    mod.status = "offline";
    mod.statusMessage = undefined;
    
    saveModules(modules);
    
    // 3. Completely delete the module's storage file from disk
    const storageFile = path.join(MODULES_STORAGE_DIR, `${moduleId}.json`);
    if (fs.existsSync(storageFile)) {
      try {
        fs.unlinkSync(storageFile);
      } catch (err) {
        console.error(`Error deleting storage file on reset for module ${moduleId}:`, err);
      }
    }
    
    // 4. Reset people's plugin settings for these capabilities
    if (capNames.length > 0) {
      try {
        const people = getPeople();
        let peopleChanged = false;
        for (const person of people) {
          if (person.pluginSettings) {
            for (const capName of capNames) {
              if (capName in person.pluginSettings) {
                delete person.pluginSettings[capName];
                peopleChanged = true;
              }
            }
          }
        }
        if (peopleChanged) {
          savePeople(people);
        }
      } catch (err) {
        console.error(`Error resetting people plugin settings on module reset for ${moduleId}:`, err);
      }
    }
    
    return true;
  }
  return false;
}

// Event Dispatching & Long Polling
interface PollingClient {
  moduleId: string;
  resolve: (eventData: any) => void;
  timer: NodeJS.Timeout;
}
const pollingClients: PollingClient[] = [];

export function addPollingClient(moduleId: string, timeoutMs: number = 30000): Promise<any> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const idx = pollingClients.findIndex(p => p.timer === timer);
      if (idx !== -1) {
        pollingClients.splice(idx, 1);
        resolve(null); // Timeout with no events
      }
    }, timeoutMs);

    pollingClients.push({ moduleId, resolve, timer });
  });
}

export async function dispatchModuleEvent(event: string, payload: any, targetModuleId?: string) {
  const modules = getModules();
  
  for (const mod of modules) {
    if (targetModuleId && mod.id !== targetModuleId) continue;
    if (!mod.connection) continue;
    
    const eventData = { event, payload, timestamp: Date.now() };

    if (mod.connection.type === "webhook" && mod.connection.webhookUrl) {
      try {
        fetch(mod.connection.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
          signal: AbortSignal.timeout(5000)
        }).catch(err => {
          console.error(`[Webhook] Error sending event to module ${mod.name}:`, err.message);
        });
      } catch (err) {
        console.error(`[Webhook] Error sending event to module ${mod.name}:`, err);
      }
    } else if (mod.connection.type === "long_polling") {
      // Find all pending long polling requests for this module and resolve them
      const clients = pollingClients.filter(c => c.moduleId === mod.id);
      for (const client of clients) {
        clearTimeout(client.timer);
        client.resolve(eventData);
        // Remove from array
        const idx = pollingClients.indexOf(client);
        if (idx !== -1) pollingClients.splice(idx, 1);
      }
    }
  }
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
    if (m.isEnabled !== false && m.capabilities) {
      const data = await readModuleStorage(m.id);
      moduleKeys[m.id] = Object.keys(data);
    }
  }

  return people.map(p => {
    const uiExtensions: any = { badges: [], customBlocks: [] };
    let hasExtensions = false;

    // Check every registered capability
    for (const m of modules) {
      if (m.isEnabled === false) continue;
      if (!m.capabilities) continue;
      for (const [capName, config] of Object.entries(m.capabilities)) {
        const isEnabled = !!(p.pluginSettings && p.pluginSettings[capName]);
        const keys = moduleKeys[m.id] || [];
        const hasData = keys.includes(p.id);

        const entityStatus = m.entityStatuses?.[`person_${p.id}`];
        if (isEnabled || (entityStatus && (entityStatus.status === "disabled" || entityStatus.status === "error"))) {
          let color = hasData ? "success" : "warning";
          let label = config.label || capName;
          let message = undefined;

          if (entityStatus) {
             if (entityStatus.status === "processing") {
                color = "warning";
             } else if (entityStatus.status === "error") {
                color = "error";
             } else if (entityStatus.status === "success") {
                color = "success";
             } else if (entityStatus.status === "disabled") {
                color = "disabled";
             }
             message = entityStatus.message;
          }

          uiExtensions.badges.push({
            label,
            color,
            message
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
