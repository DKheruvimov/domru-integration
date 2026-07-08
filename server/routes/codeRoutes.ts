import express from "express";
import path from "path";
import fs from "fs";

const router = express.Router();

// Code inspection helper endpoints
router.get("/list", (req, res) => {
  const defaultFiles = [
    { path: "src/domru-api/client.ts", name: "client.ts", category: "core" },
    { path: "src/domru-api/index.ts", name: "index.ts", category: "core" },
    { path: "src/domru-api/constants.ts", name: "constants.ts", category: "core" },
    { path: "src/domru-api/context.ts", name: "context.ts", category: "core" },
    { path: "src/domru-api/errors.ts", name: "errors.ts", category: "core" },
    { path: "src/domru-api/types.ts", name: "types.ts", category: "core" },
    { path: "src/domru-api/api/intercom.ts", name: "api/intercom.ts", category: "api" },
    { path: "src/domru-api/api/places.ts", name: "api/places.ts", category: "api" },
    { path: "src/domru-api/api/cameras.ts", name: "api/cameras.ts", category: "api" },
    { path: "src/domru-api/api/stream.ts", name: "api/stream.ts", category: "api" },
    { path: "src/domru-api/api/events.ts", name: "api/events.ts", category: "api" },
    { path: "src/domru-api/api/finances.ts", name: "api/finances.ts", category: "api" },
    { path: "src/domru-api/http/client.ts", name: "http/client.ts", category: "http" },
    { path: "src/domru-api/http/cache.ts", name: "http/cache.ts", category: "http" },
    { path: "examples/device.ts", name: "examples/device.ts", category: "interfaces" },
  ];
  res.json(defaultFiles);
});

router.get("/read", (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: "Missing path parameter" });
  }
  
  // Normalize path to prevent directory traversal (e.g. "src/domru-api/../../server/tokenStore.ts")
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  if (!normalized.startsWith("src/domru-api/") && !normalized.startsWith("examples/") && !normalized.startsWith("tests/")) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  const absolutePath = path.resolve(process.cwd(), normalized);
  // Ensure the resolved path doesn't escape the project root
  if (!absolutePath.startsWith(process.cwd())) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
