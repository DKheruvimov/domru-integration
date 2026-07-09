import fs from "fs";
import path from "path";
import express, { Router } from "express";
import { DATA_DIR } from "./config.js";
import type { CapabilityConfig } from "../shared/types.js";
import { getAllModuleCapabilities } from "./modules-manager.js";

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
  registerCapability: (capabilityName: string, config?: CapabilityConfig) => void;
  // Hooks
  onPersonLoad: (callback: (people: any[]) => Promise<any[]>) => void;
  onEvaluateAutoOpen: (callback: (person: any, deviceId: number) => Promise<boolean | undefined>) => void;
}

export class PluginManager {
  public router: Router;
  public capabilities: Record<string, CapabilityConfig>;
  
  private personLoadHooks: Array<(people: any[]) => Promise<any[]>> = [];
  private autoOpenHooks: Array<(person: any, deviceId: number) => Promise<boolean | undefined>> = [];

  constructor() {
    this.router = express.Router();
    this.capabilities = {};

    // Expose capabilities to frontend
    this.router.get("/capabilities", (req, res) => {
      res.json(getAllModuleCapabilities());
    });
  }

  public async loadPlugins() {
    // Legacy Node.js plugins are removed. All capabilities are now dynamically registered via Module API.
    console.log("[PluginManager] Legacy local plugins disabled. Awaiting dynamic module registrations.");
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
      registerCapability: (capabilityName: string, config: CapabilityConfig = {}) => {
        this.capabilities[capabilityName] = config;
        console.log(`[PluginManager] Capability registered: ${capabilityName} (by ${pluginId}) with config`, config);
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
