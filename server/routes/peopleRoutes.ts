import express from "express";
import axios from "axios";
import http from "http";
import { spawn, execSync } from "child_process";
import { getAccountsByPhone, requestSmsCode, confirmSmsCode } from "../../src/domru-api/index.js";
import { tokenCache } from "../config.js";
import { streamToString, parseMpegTsCodecs } from "../mpegTsParser.js";
import { DomruClient } from "../../src/domru-api/index.js";
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
import { pluginManager } from "../plugin-manager.js";
import { enrichPeopleWithModuleExtensions } from "../modules-manager.js";

const router = express.Router();

// API Route: Authenticate
router.get("/people", requireDomruAuth, async (req, res) => {
  try {
    const enrichedPeople = await enrichPeopleWithModuleExtensions(getPeople());
    res.json(enrichedPeople);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/people", requireDomruAuth, async (req, res) => {
  try {
    const { people } = req.body;
    if (Array.isArray(people)) {
      const oldPeople = getPeople();
      savePeople(people);

      // Notify external modules that people database changed
      import("../ws-manager.js").then(({ dispatchModuleEvent }) => {
        dispatchModuleEvent("people_updated", {});
      }).catch(err => console.error("Error dispatching people_updated:", err));

      // Detect deleted temporary cards to clean up active SIP tasks
      const newIds = new Set(people.map((p: any) => p.id));
      for (const oldPerson of oldPeople) {
        if (oldPerson.id.startsWith("temp-") && !newIds.has(oldPerson.id)) {
          const match = oldPerson.id.match(/^temp-(\d+)$/);
          if (match) {
            const deviceId = Number(match[1]);
            disableAutoOpenByDevice(deviceId);
          }
        }
      }

      // Sync updated expiresAt to activeTasks for temp cards
      const activeTasks = getActiveTasks();
      for (const p of people) {
        if (p.id.startsWith("temp-") && p.expiresAt) {
          const match = p.id.match(/^temp-(\d+)$/);
          if (match) {
            const deviceId = Number(match[1]);
            const task = activeTasks.find(t => t.deviceId === deviceId);
            if (task && task.expiresAt !== p.expiresAt) {
              task.expiresAt = p.expiresAt;
            }
          }
        }
      }

      const enrichedPeople = await enrichPeopleWithModuleExtensions(people);
      res.json({ status: "SUCCESS", people: enrichedPeople });
    } else {
      res.status(400).json({ error: "people must be an array" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/people/toggle", requireDomruAuth, async (req, res) => {
  try {
    const { id, enabled } = req.body;
    const people = getPeople();
    const person = people.find((p: any) => p.id === id);
    if (person) {
      person.enabled = enabled;
      savePeople(people);

      // Notify external modules that people database changed
      import("../ws-manager.js").then(({ dispatchModuleEvent }) => {
        dispatchModuleEvent("people_updated", {});
      }).catch(err => console.error("Error dispatching people_updated:", err));

      // If disabling a temporary/courier person, disable their active SIP task as well!
      if (!enabled && id.startsWith("temp-")) {
        const match = id.match(/^temp-(\d+)$/);
        if (match) {
          const deviceId = Number(match[1]);
          disableAutoOpenByDevice(deviceId);
        }
      }

      const enrichedPeople = await enrichPeopleWithModuleExtensions(people);
      const enrichedPerson = enrichedPeople.find(p => p.id === id);
      res.json({ status: "SUCCESS", person: enrichedPerson });
    } else {
      res.status(404).json({ error: "Person not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
