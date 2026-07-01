import express from "express";
import { loadSnapshotsIndex, deleteSnapshots, getSnapshotPath } from "../snapshots-manager.js";
import fs from "fs";
import { isDemo } from "../domruClientHelper.js";

const router = express.Router();

/**
 * GET /api/domru/snapshots/history
 * Returns the list of all snapshots.
 */
router.get("/history", async (req, res) => {
  try {
    console.log(`[Snapshots API] GET /history requested. isDemo: ${isDemo(req)}, query:`, req.query, "headers:", req.headers["x-domru-login"]);
    if (isDemo(req)) {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const timestamps = [
        now - 1000 * 60 * 5,
        now - 1000 * 60 * 60 * 2,
        now - dayMs - 1000 * 60 * 60,
        now - dayMs * 2,
        now - dayMs * 4,
        now - dayMs * 10,
        now - dayMs * 15,
        now - dayMs * 35,
        now - dayMs * 40,
      ];
      const mockEntries = timestamps.map((ts, i) => ({
        id: `demo-snap-${i}`,
        timestamp: ts,
        login: "demo",
        placeId: 1001,
        deviceId: 2001,
        fileName: `demo-${i}.jpg`
      }));
      return res.json(mockEntries);
    }

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
    if (isDemo(req)) {
      return res.json({ success: true, deletedCount: ids.length });
    }

    const result = deleteSnapshots(ids);
    res.json(result);
  } catch (error) {
    console.error("[Snapshots API] Failed to delete snapshots:", error);
    res.status(500).json({ error: "Failed to delete snapshots" });
  }
});

/**
 * GET /api/domru/snapshots/:fileName
 * Serves the actual image file.
 */
router.get("/:fileName", async (req, res) => {
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

  const { fileName } = req.params;
  const filePath = getSnapshotPath(fileName);
  
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=2592000"); // cache for 30 days
    return res.sendFile(filePath);
  }
  
  res.status(404).json({ error: "Snapshot not found" });
});

export default router;
