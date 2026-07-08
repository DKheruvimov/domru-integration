import { Router } from "express";
import { 
  getModules, 
  createModule, 
  deleteModule, 
  validateModuleToken 
} from "../modules-manager.js";
import { handleManualOpen } from "../sip-manager.js";
import { loadSavedTokens } from "../tokenStore.js";
import { DomruClient } from "../../src/domru-js/index.js";

const router = Router();

// UI Endpoint: List all modules
router.get("/", (req, res) => {
  const modules = getModules();
  res.json(modules);
});

// UI Endpoint: Create a new module
router.post("/", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  
  const newModule = createModule(name);
  res.json(newModule);
});

// UI Endpoint: Delete a module
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  const success = deleteModule(id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Module not found" });
  }
});

// External Module Endpoint: Action Open
router.post("/actions/open", async (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    token = String(req.query.token || "").trim();
  }

  const module = validateModuleToken(token);
  if (!module) {
    return res.status(403).json({ error: "Invalid or missing module token" });
  }

  const { deviceId } = req.body;
  
  try {
    const tokens = loadSavedTokens();
    const accounts = Object.values(tokens);
    if (accounts.length === 0) {
      return res.status(500).json({ error: "No configured Dom.ru accounts found on server" });
    }

    const creds = accounts[0];
    const client = new DomruClient({
      login: creds.login,
      password: creds.password,
      operatorId: creds.operatorId || 41
    });

    let targetPlaceId = 0;
    
    // Attempt to auto-detect placeId if not provided
    const places = await client.getSubscriberPlaces();
    if (places.length > 0) {
      targetPlaceId = places[0].place?.id || places[0].id;
    }

    if (!deviceId) {
      // Auto-detect device if not specified
      if (targetPlaceId) {
        const devices = await client.getDevices(targetPlaceId);
        const intercom = devices.find((d: any) => d.allowOpen);
        if (intercom) {
          await handleManualOpen(targetPlaceId, intercom.id, client, `Модуль: ${module.name}`);
          return res.json({ success: true, message: "Opened default door" });
        }
      }
      return res.status(400).json({ error: "deviceId is required and no default intercom found" });
    }

    await handleManualOpen(targetPlaceId, Number(deviceId), client, `Модуль: ${module.name}`);
    res.json({ success: true, message: "Door opened" });

  } catch (error: any) {
    console.error("Module Open Error:", error);
    res.status(500).json({ error: error.message || "Failed to open door" });
  }
});

export default router;
