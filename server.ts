import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { resolve } from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import "./server/config.js";
import codeRoutes from "./server/routes/codeRoutes.js";
import domruRoutes from "./server/routes/domruRoutes.js";
import yandexRoutes from "./server/routes/yandexRoutes.js";
import yandexDialogs from "./server/routes/yandexDialogs.js";
import settingsRoutes from "./server/routes/settingsRoutes.js";
import modulesRoutes from "./server/routes/modulesRoutes.js";
import { loadAndResumeActiveTasks } from "./server/sip-manager.js";
import { initPermanentSipBindings } from "./server/sip-init.js";
import { startGo2Rtc, handleWsProxy } from "./server/go2rtc-manager.js";
import { WebSocketServer } from "ws";
import { initWebSocketServer } from "./server/ws-manager.js";
import { pluginManager } from "./server/plugin-manager.js";

import { PORT } from "./server/config.js";

async function startServer() {
  const app = express();

  app.set("trust proxy", true);

  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Prevent CDN caching for API routes
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mount modular route controllers
  app.use("/api/code", codeRoutes);
  app.use("/api/domru", domruRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/modules", modulesRoutes);
  app.use("/api/yandex/dialogs", yandexDialogs);
  app.use("/", yandexRoutes);

  // Initialize and mount plugins
  await pluginManager.loadPlugins();
  app.use("/api/plugins", pluginManager.router);

  // Serve static assets / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
    loadAndResumeActiveTasks();
    initPermanentSipBindings();
    startGo2Rtc().catch((err) => {
      console.error("Failed to start go2rtc on boot:", err);
    });
  });

  // Initialize socket.io for real-time app events
  initWebSocketServer(server);

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const urlObj = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      if (urlObj.pathname === "/api/go2rtc/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          handleWsProxy(ws, request.url || "");
        });
      }
    } catch (err) {
      console.error("[Server Upgrade] Error parsing upgrade URL:", err);
    }
  });
}

startServer();
