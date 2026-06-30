import express from "express";
import { loadSnapshotsIndex, deleteSnapshots } from "../snapshots-manager.js";

const router = express.Router();

/**
 * GET /api/domru/snapshots/history
 * Returns the list of all snapshots.
 */
router.get("/history", async (req, res) => {
  try {
    const entries = loadSnapshotsIndex();
    // Sort by timestamp DESC
    entries.sort((a, b) => b.timestamp - a.timestamp);
    res.json(entries);
  } catch (error) {
    console.error("[Snapshots API] Failed to load history:", error);
    res.status(500).json({ error: "Failed to load snapshots history" });
  }
});

/**
 * POST /api/domru/snapshots/delete
 * Expects { ids: string[] }
 */
router.post("/delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: "ids must be an array of strings" });
    }
    const result = deleteSnapshots(ids);
    res.json(result);
  } catch (error) {
    console.error("[Snapshots API] Failed to delete snapshots:", error);
    res.status(500).json({ error: "Failed to delete snapshots" });
  }
});

export default router;
