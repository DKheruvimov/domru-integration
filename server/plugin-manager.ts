import fs from "fs";
import path from "path";
import express, { Router } from "express";
import { DATA_DIR } from "./config.js";

// Ensure plugins data directory exists
const PLUGINS_DATA_DIR = path.join(DATA_DIR, "plugins");
if (!fs.existsSync(PLUGINS_DATA_DIR)) {
  fs.mkdirSync(PLUGINS_DATA_DIR, { recursive: true });
}

export interface PluginStorage {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
  getAll: () => Promise<Record<string, any>>;
  clear: () => Promise<void>;
}

export interface PluginAPI {
  pluginId: string;
  storage: PluginStorage;
  router: Router;
  registerCapability: (capabilityName: string) => void;
  // Hooks
  onPersonLoad: (callback: (people: any[]) => Promise<any[]>) => void;
  onEvaluateAutoOpen: (callback: (person: any, deviceId: number) => Promise<boolean | undefined>) => void;
}

export class PluginManager {
  public router: Router;
  public capabilities: Set<string>;
  
  private personLoadHooks: Array<(people: any[]) => Promise<any[]>> = [];
  private autoOpenHooks: Array<(person: any, deviceId: number) => Promise<boolean | undefined>> = [];

  constructor() {
    this.router = express.Router();
    this.capabilities = new Set();
  }

  public async loadPlugins() {
    // In a real system we would scan the /plugins folder.
    // For this prototype, we'll manually require the face-id plugin.
    try {
      // Dynamic import to avoid static coupling
      const faceIdPlugin = await import("../plugins/face-id/index.js");
      await this.initPlugin("face-id", faceIdPlugin.default);
      console.log("[PluginManager] Successfully loaded plugins.");
    } catch (e) {
      console.error("[PluginManager] Failed to load plugins:", e);
    }
  }

  private async initPlugin(pluginId: string, initFn: (api: PluginAPI) => Promise<void> | void) {
    const pluginRouter = express.Router();
    this.router.use(`/${pluginId}`, pluginRouter);

    const storageFile = path.join(PLUGINS_DATA_DIR, `${pluginId}.json`);
    
    const readStorage = async (): Promise<Record<string, any>> => {
      if (!fs.existsSync(storageFile)) return {};
      const data = await fs.promises.readFile(storageFile, "utf-8");
      return JSON.parse(data);
    };
    
    const writeStorage = async (data: Record<string, any>) => {
      await fs.promises.writeFile(storageFile, JSON.stringify(data, null, 2), "utf-8");
    };

    const storage: PluginStorage = {
      get: async (key: string) => {
        const data = await readStorage();
        return data[key];
      },
      set: async (key: string, value: any) => {
        const data = await readStorage();
        data[key] = value;
        await writeStorage(data);
      },
      delete: async (key: string) => {
        const data = await readStorage();
        delete data[key];
        await writeStorage(data);
      },
      getAll: async () => {
        return await readStorage();
      },
      clear: async () => {
        await writeStorage({});
      }
    };

    const api: PluginAPI = {
      pluginId,
      storage,
      router: pluginRouter,
      registerCapability: (capabilityName: string) => {
        this.capabilities.add(capabilityName);
        console.log(`[PluginManager] Capability registered: ${capabilityName} (by ${pluginId})`);
      },
      onPersonLoad: (callback) => {
        this.personLoadHooks.push(callback);
      },
      onEvaluateAutoOpen: (callback) => {
        this.autoOpenHooks.push(callback);
      }
    };

    await initFn(api);
  }

  // --- Core Hooks ---
  
  public async executePersonLoadHooks(people: any[]): Promise<any[]> {
    let result = [...people];
    for (const hook of this.personLoadHooks) {
      result = await hook(result);
    }
    return result;
  }

  /**
   * Executes auto open hooks. Returns true if ANY plugin authorizes the open.
   * Returns false if a plugin explicitly denies it.
   * Returns undefined if no plugin makes a decision.
   */
  public async executeAutoOpenHooks(person: any, deviceId: number): Promise<boolean | undefined> {
    for (const hook of this.autoOpenHooks) {
      const result = await hook(person, deviceId);
      if (result !== undefined) {
        return result; // First plugin to decide wins
      }
    }
    return undefined; // No plugin decision
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
