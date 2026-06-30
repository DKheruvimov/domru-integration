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

  saveSettings(currentSettings);
  res.json(currentSettings);
});

export default router;
