import { Router } from "express";
import { 
  getModules, 
  createModule, 
  deleteModule, 
  validateModuleToken 
} from "../modules-manager.js";
import { handleManualOpen } from "../sip-manager.js";
import { loadSavedTokens } from "../tokenStore.js";
import { DomruClient } from "../../src/domru-api/index.js";
import { PORT } from "../config.js";
import { registerStream } from "../go2rtc-manager.js";

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

  const { deviceId, personId, capability } = req.body;
  
  if (personId) {
    const { getPeople, isScheduleActive, savePeople, getMskDateString } = await import("../people-manager.js");
    const people = getPeople();
    const person = people.find((p: any) => p.id === personId);
    
    if (!person) {
      return res.status(404).json({ error: "Person not found" });
    }
    if (!person.enabled) {
      return res.status(403).json({ error: "Person is disabled" });
    }
    
    if (capability && person.pluginSettings && person.pluginSettings[capability] === false) {
      return res.status(403).json({ error: `Capability ${capability} is disabled for this person` });
    }

    if (person.useSchedule !== false && !isScheduleActive(person)) {
      return res.status(403).json({ error: "Person is not allowed by schedule at this time" });
    }

    if (person.role !== "resident" && person.opensRemaining !== undefined && person.opensRemaining !== null) {
      if (person.opensRemaining <= 0) {
        return res.status(403).json({ error: "Person has no remaining opens" });
      }
      person.opensRemaining = Math.max(0, person.opensRemaining - 1);
      person.lastOpenedDate = getMskDateString(new Date());
      savePeople(people);
    }
  }
  
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

    await handleManualOpen(targetPlaceId, Number(deviceId), client, `Модуль: ${module.name}${personId ? ' (ID: ' + personId + ')' : ''}`);
    res.json({ success: true, message: "Door opened" });

  } catch (error: any) {
    console.error("Module Open Error:", error);
    res.status(500).json({ error: error.message || "Failed to open door" });
  }
});

// Helper function to get an authenticated DomruClient
function getModuleDomruClient(): DomruClient | null {
  const tokens = loadSavedTokens();
  const accounts = Object.values(tokens);
  if (accounts.length === 0) return null;
  
  const creds = accounts[0];
  return new DomruClient({
    login: creds.login,
    password: creds.password,
    refreshToken: creds.refreshToken,
    operatorId: creds.operatorId || 41
  });
}

// External Module Endpoint: Action Snapshot
router.get("/actions/snapshot/:placeId/:deviceId", async (req, res) => {
  const token = String(req.query.token || "").trim();
  const module = validateModuleToken(token);
  
  if (!module) {
    return res.status(403).json({ error: "Invalid or missing module token" });
  }

  const { placeId, deviceId } = req.params;
  
  try {
    const client = getModuleDomruClient();
    if (!client) {
      return res.status(500).json({ error: "No configured Dom.ru accounts found on server" });
    }

    const snapshotBuffer = await client.getSnapshot(Number(placeId), Number(deviceId));
    if (!snapshotBuffer || snapshotBuffer.length === 0) {
      return res.status(404).send("Failed to retrieve snapshot");
    }

    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "no-store");
    res.send(snapshotBuffer);
  } catch (error: any) {
    console.error("Module Snapshot Error:", error);
    res.status(500).json({ error: error.message || "Failed to get snapshot" });
  }
});

// External Module Endpoint: Action Stream
router.get("/actions/stream/:deviceId", async (req, res) => {
  const token = String(req.query.token || "").trim();
  const module = validateModuleToken(token);
  
  if (!module) {
    return res.status(403).json({ error: "Invalid or missing module token" });
  }

  const { deviceId } = req.params;
  
  try {
    const client = getModuleDomruClient();
    if (!client) {
      return res.status(500).json({ error: "No configured Dom.ru accounts found on server" });
    }

    // Attempting to auto-authenticate to ensure valid token for stream URL
    if (!client.token) {
      await client.authenticate();
    }

    const stream = await client.getStreamUrl(deviceId);
    if (!stream || !stream.url) {
      return res.status(404).json({ error: "No stream found for camera" });
    }

    const originalUrl = stream.url;
    const proxiedLoopbackUrl = `http://127.0.0.1:${PORT}/api/domru/stream-proxy/index.m3u8?url=${encodeURIComponent(originalUrl)}&token=${encodeURIComponent(client.token || "")}&operatorId=${encodeURIComponent(String(client.refreshData.operatorId || ""))}&transcode=false`;
    const go2rtcSource = `ffmpeg:${proxiedLoopbackUrl}#video=copy#audio=opus#input=hls_re`;
    
    const success = await registerStream(deviceId, go2rtcSource);
    
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const wsProtocol = protocol === "https" ? "wss" : "ws";
    const hostHeader = req.headers.host || `localhost:${PORT}`;

    res.json({
      success,
      deviceId,
      webrtcUrl: `${wsProtocol}://${hostHeader}/api/go2rtc/ws?src=${deviceId}`,
      mseUrl: `${wsProtocol}://${hostHeader}/api/go2rtc/ws?src=${deviceId}&media=mse`,
      hlsUrl: `${protocol}://${hostHeader}/api/domru/go2rtc-proxy/api/hls.m3u8?src=${deviceId}`,
      mjpegUrl: `${protocol}://${hostHeader}/api/domru/go2rtc-proxy/api/frame.mp4?src=${deviceId}`,
      originalUrl: originalUrl
    });

  } catch (error: any) {
    console.error("Module Stream Error:", error);
    res.status(500).json({ error: error.message || "Failed to get stream" });
  }
});

export default router;
