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
router.get("/places", async (req, res) => {
  if (isDemo(req)) {
    return res.json(MOCK_PLACES);
  }

  try {
    const client = getDomruInstance(req);
    const places = await client.getSubscriberPlaces();
    res.json(places);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Devices
router.get("/devices/:placeId", async (req, res) => {
  const placeId = Number(req.params.placeId);
  if (isDemo(req)) {
    const devices = (MOCK_DEVICES as any)[placeId] || [];
    return res.json(devices);
  }

  try {
    const client = getDomruInstance(req);
    const devices = await client.getDevices(placeId);
    res.json(devices);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Cameras
router.get("/cameras", async (req, res) => {
  if (isDemo(req)) {
    return res.json(MOCK_CAMERAS);
  }

  try {
    const client = getDomruInstance(req);
    const cameras = await client.getCameras();
    res.json(cameras);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Debug stream codecs
export default router;
