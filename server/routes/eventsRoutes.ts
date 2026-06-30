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
} from "../domruClientHelper.js";
import { getProxiedStreamUrl } from "../yandexHelper.js";
import { registerStream } from "../go2rtc-manager.js";
import { enableAutoOpen, disableAutoOpen, disableAutoOpenByDevice, getSipLogs, getActiveTasks, handleManualOpen, getPermanentBindings } from "../sip-manager.js";
import { getPeople, savePeople, addTemporaryAutoOpenPerson, removeTemporaryAutoOpenPerson, isScheduleActive } from "../people-manager.js";
import { findSnapshotForEvent, getSnapshotPath } from "../snapshots-manager.js";
import { getOpeningByOurService } from "../openings-manager.js";
import fs from "fs";

const router = express.Router();

// API Route: Authenticate
router.post("/events", async (req, res) => {
  const { placeIds, page, sort } = req.body;
  if (isDemo(req)) {
    const enhancedMockEvents = MOCK_EVENTS.map((e: any) => {
      const eventTimeMs = new Date(e.timestamp).getTime();
      const snapshot = findSnapshotForEvent(1001, eventTimeMs) || findSnapshotForEvent(2001, eventTimeMs);
      let resEvent = { ...e };
      if (snapshot) {
        resEvent.sipSnapshotUrl = `/api/domru/snapshots/${snapshot.fileName}`;
      }
      
      const opening = getOpeningByOurService(1001, eventTimeMs) || getOpeningByOurService(2001, eventTimeMs);
      if (opening) {
        resEvent.openedByOurService = {
          type: opening.type,
          details: opening.details
        };
      }
      return resEvent;
    });
    return res.json(enhancedMockEvents);
  }

  try {
    const client = getDomruInstance(req);
    const events = await client.getEvents(placeIds, page, sort);
    
    // Inject local SIP snapshot URLs and local door opening information
    const enhancedEvents = events.map((e: any) => {
      let resEvent = { ...e };
      const sourceId = e.source?.id || e.device?.id;
      
      let eventTimeMs = null;
      const rawTime = e.occurredAt || e.timestamp;
      
      if (rawTime) {
        if (typeof rawTime === "number") {
          eventTimeMs = rawTime;
        } else {
          let cleaned = String(rawTime).trim();
          
          // Handle DD.MM.YYYY HH:mm:ss or DD-MM-YYYY HH:mm:ss
          const ruDateMatch = cleaned.match(/^(\d{2})[.-](\d{2})[.-](\d{4})(?:\s+(.*))?$/);
          if (ruDateMatch) {
            const [_, dd, mm, yyyy, timePart] = ruDateMatch;
            cleaned = `${yyyy}-${mm}-${dd}${timePart ? 'T' + timePart : ''}`;
          }
          
          if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(cleaned)) {
            cleaned = cleaned.replace(" ", "T");
          }
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) {
            eventTimeMs = d.getTime();
          } else {
            console.error(`[Events] Failed to parse timestamp: ${rawTime}`);
          }
        }
      }
        
      if (eventTimeMs) {
        resEvent.debug_eventTimeMs = eventTimeMs;
        const snapshot = findSnapshotForEvent(Number(e.placeId), eventTimeMs);
        if (snapshot) {
          resEvent.sipSnapshotUrl = `/api/domru/snapshots/${snapshot.fileName}`;
        } else {
          // Find the closest snapshot just to debug
          const entries = loadSnapshotsIndex();
          let closestDiff = Infinity;
          for (const entry of entries) {
            const diff = Math.abs(entry.timestamp - eventTimeMs);
            if (diff < closestDiff) closestDiff = diff;
          }
          resEvent.debug_closestSnapshotDiffMs = closestDiff;
        }

        const opening = getOpeningByOurService(Number(e.placeId), eventTimeMs);
        if (opening) {
          resEvent.openedByOurService = {
            type: opening.type,
            details: opening.details
          };
        }
      } else {
        resEvent.debug_error = "Could not parse eventTimeMs from rawTime: " + rawTime;
      }
      return resEvent;
    });

    res.json(enhancedEvents);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Guest Temporal PIN codes
router.post("/temporal", async (req, res) => {
  const { deviceIds } = req.body;
  if (isDemo(req)) {
    return res.json([
      {
        id: 301,
        deviceId: deviceIds[0] || 2001,
        code: "3810",
        name: "Курьер Самокат",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 302,
        deviceId: deviceIds[0] || 2001,
        code: "9552",
        name: "Друзья",
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      },
    ]);
  }

  try {
    const client = getDomruInstance(req);
    const codes = await client.getTemporalCodes(deviceIds);
    res.json(codes);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Subscriber Finances
router.get("/finances", async (req, res) => {
  if (isDemo(req)) {
    return res.json({
      balance: 350.0,
      paymentPeriod: "до 25.06.2026",
      accountNumber: "278104829",
    });
  }

  try {
    const client = getDomruInstance(req);
    const finances = await client.getFinances();
    res.json(finances);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Routes: People Schedules
export default router;
