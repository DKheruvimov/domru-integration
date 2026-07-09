import { Router } from "express";
import { getSettings, saveSettings } from "../settings-manager.js";

const router = Router();

router.get("/", (req, res) => {
  const settings = getSettings();
  res.json(settings);
});

router.post("/", (req, res) => {
  const newSettings = req.body;
  if (!newSettings || typeof newSettings !== "object") {
    return res.status(400).json({ error: "Invalid settings payload" });
  }

  const currentSettings = getSettings();
  
  if (typeof newSettings.autoOpenDelayResidentMs === "number") {
    currentSettings.autoOpenDelayResidentMs = newSettings.autoOpenDelayResidentMs;
  }
  if (typeof newSettings.autoOpenDelayGuestMs === "number") {
    currentSettings.autoOpenDelayGuestMs = newSettings.autoOpenDelayGuestMs;
  }
  if (typeof newSettings.customDomain === "string") {
    currentSettings.customDomain = newSettings.customDomain;
  }
  if (typeof newSettings.timezone === "string") {
    currentSettings.timezone = newSettings.timezone;
  }

  saveSettings(currentSettings);
  res.json(currentSettings);
});

router.post("/diagnostics/yandex", async (req, res) => {
  const { customDomain } = req.body;
  if (!customDomain) return res.status(400).json({ error: "Missing customDomain" });

  let baseUrl = customDomain.trim();
  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  const results = {
    dns: { status: "pending", message: "" },
    authorize: { status: "pending", message: "" },
    token: { status: "pending", message: "" },
    dialogs: { status: "pending", message: "" },
  };

  try {
    // 1. Check basic reachability / Authorize endpoint + WAF (with Yandex User-Agent and URL in query)
    try {
      const authUrl = `${baseUrl}/oauth/authorize?client_id=myhome_app&response_type=code&state=https://social.yandex.net/broker/redirect&redirect_uri=https://social.yandex.net/broker/redirect`;
      const authRes = await fetch(authUrl, {
        headers: { "User-Agent": "YandexSmartHome/1.0" },
        signal: AbortSignal.timeout(5000)
      });
      if (authRes.status === 403 || authRes.status === 400) {
         results.authorize = { status: "error", message: `WAF/Server block (HTTP ${authRes.status}). Check TurboFlare rules.` };
      } else {
         results.authorize = { status: "success", message: `OK (HTTP ${authRes.status})` };
      }
      results.dns = { status: "success", message: "Domain resolved successfully" };
    } catch (e: any) {
      results.dns = { status: "error", message: e.message || "Failed to reach domain" };
      results.authorize = { status: "error", message: "Unreachable" };
    }

    // 2. Check Token endpoint
    try {
      const tokenRes = await fetch(`${baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "User-Agent": "YandexSmartHome/1.0" },
        signal: AbortSignal.timeout(5000)
      });
      if (tokenRes.status === 403) {
        results.token = { status: "error", message: "WAF blocked POST request (HTTP 403)" };
      } else {
        results.token = { status: "success", message: `OK (HTTP ${tokenRes.status})` };
      }
    } catch (e: any) {
      results.token = { status: "error", message: "Failed to connect" };
    }

    // 3. Check Dialogs endpoint
    try {
      const dialogsRes = await fetch(`${baseUrl}/api/yandex/dialogs`, {
        method: "POST",
        headers: { 
          "User-Agent": "ru.yandex.searchplugin/7.16 (none none; android 4.4.2)",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ request: { command: "ping" }, session: {} }),
        signal: AbortSignal.timeout(5000)
      });
      if (dialogsRes.status === 403) {
        results.dialogs = { status: "error", message: "WAF blocked bot User-Agent (HTTP 403)" };
      } else {
        results.dialogs = { status: "success", message: `OK (HTTP ${dialogsRes.status})` };
      }
    } catch (e: any) {
      results.dialogs = { status: "error", message: "Failed to connect" };
    }

    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
