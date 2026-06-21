import express from "express";
import path from "path";
import fs from "fs";

const router = express.Router();

// Code inspection helper endpoints
router.get("/list", (req, res) => {
  const defaultFiles = [
    { path: "src/domru-js/client.ts", name: "client.ts", category: "core" },
    { path: "src/domru-js/index.ts", name: "index.ts", category: "core" },
    { path: "src/domru-js/constants.ts", name: "constants.ts", category: "core" },
    { path: "src/domru-js/context.ts", name: "context.ts", category: "core" },
    { path: "src/domru-js/errors.ts", name: "errors.ts", category: "core" },
    { path: "src/domru-js/types.ts", name: "types.ts", category: "core" },
    { path: "src/domru-js/api/intercom.ts", name: "api/intercom.ts", category: "api" },
    { path: "src/domru-js/api/places.ts", name: "api/places.ts", category: "api" },
    { path: "src/domru-js/api/cameras.ts", name: "api/cameras.ts", category: "api" },
    { path: "src/domru-js/api/stream.ts", name: "api/stream.ts", category: "api" },
    { path: "src/domru-js/api/events.ts", name: "api/events.ts", category: "api" },
    { path: "src/domru-js/api/finances.ts", name: "api/finances.ts", category: "api" },
    { path: "src/domru-js/http/client.ts", name: "http/client.ts", category: "http" },
    { path: "src/domru-js/http/cache.ts", name: "http/cache.ts", category: "http" },
    { path: "examples/device.ts", name: "examples/device.ts", category: "interfaces" },
  ];
  res.json(defaultFiles);
});

router.get("/read", (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath || (!filePath.startsWith("src/domru-js/") && !filePath.startsWith("examples/") && !filePath.startsWith("tests/"))) {
    return res.status(403).json({ error: "Access denied" });
  }
  const absolutePath = path.join(process.cwd(), filePath);
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
