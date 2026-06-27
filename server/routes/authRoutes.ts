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
router.post("/login", async (req, res) => {
  if (isDemo(req)) {
    return res.json({
      success: true,
      token: "demo-access-token-123",
      refreshData: {
        refreshToken: "demo-refresh-token-456",
        operatorId: 123,
      },
    });
  }

  try {
    const client = getDomruInstance(req);
    await client.authenticate();
    res.json({
      success: true,
      token: client.token,
      refreshData: client.refreshData,
    });
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: SMS Accounts Fetch
router.post("/sms/accounts", async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Необходим номер телефона" });
  }

  const cleanPhone = normalizePhone(phone);

  if (isDemo(req)) {
    return res.json([
      {
        operatorId: 123,
        subscriberId: 111111,
        accountId: "demo_acc_1",
        placeId: 1001,
        address: "ул. Ленина, д. 10, кв. 42 (Песочница)",
        profileId: "demo_profile_1"
      },
      {
        operatorId: 123,
        subscriberId: 222222,
        accountId: "demo_acc_2",
        placeId: 1002,
        address: "ул. Гагарина, д. 5, кв. 7 (Песочница)",
        profileId: "demo_profile_2"
      }
    ]);
  }

  try {
    const accounts = await getAccountsByPhone(cleanPhone);
    res.json(accounts);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Send SMS code
router.post("/sms/request", async (req, res) => {
  const { phone, account } = req.body;
  if (!phone || !account) {
    return res.status(400).json({ error: "Необходимы номер телефона и аккаунт" });
  }

  const cleanPhone = normalizePhone(phone);

  if (isDemo(req)) {
    return res.json({ success: true, message: "Код отправлен (Имитация)" });
  }

  try {
    const success = await requestSmsCode(cleanPhone, account);
    res.json({ success });
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Confirm SMS code
router.post("/sms/confirm", async (req, res) => {
  const { phone, code, account } = req.body;
  if (!phone || !code || !account) {
    return res.status(400).json({ error: "Необходимы номер телефона, код подтверждения и аккаунт" });
  }

  const cleanPhone = normalizePhone(phone);

  if (isDemo(req)) {
    if (code === "0000" || code === "1234" || code === "5555" || code.length === 4) {
      return res.json({
        success: true,
        token: "demo-access-token-123",
        refreshData: {
          refreshToken: "demo-refresh-token-456",
          operatorId: account.operatorId || 123,
        },
      });
    } else {
      return res.status(400).json({ error: "Неверный код (В режиме демо введите любой 4-значный код)" });
    }
  }

  try {
    const response = await confirmSmsCode(cleanPhone, code, account);
    res.json({
      success: true,
      token: response.accessToken,
      refreshData: {
        refreshToken: response.refreshToken,
        operatorId: response.operatorId,
      },
    });
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Subscriber Places
export default router;
