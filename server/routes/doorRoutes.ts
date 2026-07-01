import express from "express";
import axios from "axios";
import http from "http";
import { spawn, execSync } from "child_process";
import { getAccountsByPhone, requestSmsCode, confirmSmsCode } from "../../src/domru-js/index.js";
import { tokenCache } from "../config.js";
import { streamToString, parseMpegTsCodecs } from "../mpegTsParser.js";
import { DomruClient } from "../../src/domru-js/index.js";
import {
  handleClientError,
  getDomruInstance,
  isDemo,
  normalizePhone,
  MOCK_PLACES,
  MOCK_DEVICES,
  MOCK_CAMERAS,
  MOCK_EVENTS,
  requireDomruAuth,
} from "../domruClientHelper.js";
import { getProxiedStreamUrl } from "../yandexHelper.js";
import { registerStream } from "../go2rtc-manager.js";
import { enableAutoOpen, disableAutoOpen, disableAutoOpenByDevice, getSipLogs, getActiveTasks, handleManualOpen, getPermanentBindings } from "../sip-manager.js";
import { getPeople, savePeople, addTemporaryAutoOpenPerson, removeTemporaryAutoOpenPerson, isScheduleActive } from "../people-manager.js";
import { findSnapshotForEvent, getSnapshotPath } from "../snapshots-manager.js";
import { getOpeningByOurService } from "../openings-manager.js";
import fs from "fs";

const router = express.Router();

// API Route: Camera Snapshot
router.get("/snapshot/:placeId/:deviceId", requireDomruAuth, async (req, res) => {
  const { placeId, deviceId } = req.params;
  if (isDemo(req)) {
    try {
      const dummyResponse = await fetch("https://picsum.photos/640/360");
      const buffer = await dummyResponse.arrayBuffer();
      res.setHeader("Content-Type", "image/jpeg");
      return res.send(Buffer.from(buffer));
    } catch {
      return res.status(500).send("Demo image error");
    }
  }

  try {
    const client = getDomruInstance(req);
    const snapshot = await client.getSnapshot(Number(placeId), Number(deviceId));
    if (!snapshot) {
      return res.status(404).send("Snapshot failed or not available");
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", snapshot.length);
    res.send(Buffer.from(snapshot));
  } catch (err: any) {
    console.error("Failed to fetch camera snapshot:", err);
    res.status(500).send(err.message || "Failed to fetch camera snapshot");
  }
});

// API Route: Open Intercom Door/Gate
router.post("/open", requireDomruAuth, async (req, res) => {
  const { placeId, deviceId } = req.body;
  if (isDemo(req)) {
    const { recordDoorOpening } = await import("../openings-manager.js");
    recordDoorOpening(Number(placeId || 1001), Number(deviceId || 2001), "manual", "Вручную (без звонка)");
    return res.json({
      status: "SUCCESS",
      message: "Дверь успешно открыта",
    });
  }

  try {
    const client = getDomruInstance(req);
    await handleManualOpen(Number(placeId), Number(deviceId), client, "Web");
    res.json({ status: "SUCCESS", message: "Дверь открыта (SIP interception applied if ringing)" });
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Get SIP Logs
router.get("/sip/logs", requireDomruAuth, (req, res) => {
  res.json(getSipLogs());
});

// API Route: Get SIP Auto Open Status
router.get("/sip/auto-open/status", requireDomruAuth, (req, res) => {
  const activeTasks = getActiveTasks();
  const status: Record<number, number | boolean> = {};
  for (const task of activeTasks) {
    status[task.deviceId] = task.expiresAt;
  }

  // Check if we have active guests or couriers currently scheduled
  try {
    const people = getPeople();
    const activeGuest = people.find(p => p.role !== "resident" && isScheduleActive(p));
    if (activeGuest) {
      // Find all device IDs that we have permanent bindings for, and set status to true
      const bindings = getPermanentBindings();
      
      for (const binding of bindings) {
        if (!status[binding.deviceId]) {
          status[binding.deviceId] = true;
        }
      }
      
      // Fallback: also enable for mock devices so they light up in the frontend camera view immediately
      const allMockDevices = Object.values(MOCK_DEVICES).flat();
      for (const dev of allMockDevices) {
        if (!status[dev.id]) {
          status[dev.id] = true;
        }
      }
      
      // Add a global flag so the UI can highlight the auto-open button for all devices
      (status as any)["global"] = true;
    }
  } catch (err) {
    console.error("Error updating auto-open status from schedules:", err);
  }

  res.json(status);
});

// API Route: Toggle SIP Courier Auto Open
router.post("/sip/auto-open", requireDomruAuth, async (req, res) => {
  const { placeId, deviceId, enabled, durationMinutes, maxOpens } = req.body;
  
  if (enabled) {
    addTemporaryAutoOpenPerson(Number(deviceId), maxOpens || null, durationMinutes || 60);
  } else {
    removeTemporaryAutoOpenPerson(Number(deviceId));
  }

  if (isDemo(req)) {
    return res.json({ status: "SUCCESS", message: enabled ? "Включено авто-открытие (Demo)" : "Отключено" });
  }

  try {
    const client = getDomruInstance(req);

    if (enabled) {
      const { createHash } = await import("crypto");
      const ctx = (client as any).ctx;
      const installationId = createHash("md5").update(`autoopen-${placeId}-${deviceId}-${ctx?.login || ""}`).digest("hex");
      const credentials = await client.getSipCredentials(Number(placeId), Number(deviceId), installationId);
      
      const expiresAt = Date.now() + (durationMinutes ? durationMinutes * 60 * 1000 : 60 * 60 * 1000);
      
      const domruCredentials = {
        login: ctx?.login,
        password: ctx?.password,
        refreshToken: ctx?.refreshToken,
        operatorId: ctx?.operatorId,
        accessToken: ctx?.accessToken,
      };

      enableAutoOpen({
        placeId: Number(placeId),
        deviceId: Number(deviceId),
        credentials,
        expiresAt,
        maxOpens: typeof maxOpens === "number" ? maxOpens : null,
        domruCredentials,
        onOpenDoor: async () => {
          await client.openDoor(Number(placeId), Number(deviceId));
          const { recordDoorOpening } = await import("../openings-manager.js");
          recordDoorOpening(Number(placeId), Number(deviceId), "auto", `Временное авто-открытие SIP (${credentials.login})`);
        }
      });
      res.json({ status: "SUCCESS", message: "SIP Auto-open enabled", login: credentials.login, expiresAt });
    } else {
      const { login } = req.body;
      if (login) disableAutoOpen(login);
      else disableAutoOpenByDevice(Number(deviceId));
      res.json({ status: "SUCCESS", message: "SIP Auto-open disable signal sent" });
    }
  } catch (err: any) {
    import("../sip-manager.js").then(m => m.addSipLog(`[SIP] API Error: ${err.message || err}`, "error")).catch(() => {});
    handleClientError(err, res);
  }
});

// API Route: Historical Events
export default router;
