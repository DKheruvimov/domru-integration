import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_FILE = path.join(process.cwd(), "data", "modules.json");

export interface ExternalModule {
  id: string;
  name: string;
  token: string;
  createdAt: number;
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
