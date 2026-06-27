import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import "./server/config.js";
import codeRoutes from "./server/routes/codeRoutes.js";
import domruRoutes from "./server/routes/domruRoutes.js";
import yandexRoutes from "./server/routes/yandexRoutes.js";
import yandexDialogs from "./server/routes/yandexDialogs.js";
import { loadAndResumeActiveTasks } from "./server/sip-manager.js";
import { initPermanentSipBindings } from "./server/sip-init.js";
import { startGo2Rtc, handleWsProxy } from "./server/go2rtc-manager.js";
import { WebSocketServer } from "ws";

import { PORT } from "./server/config.js";

async function startServer() {
  const app = express();

  app.set("trust proxy", true);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mount modular route controllers
  app.use("/api/code", codeRoutes);
  app.use("/api/domru", domruRoutes);
  app.use("/api/yandex/dialogs", yandexDialogs);
  app.use("/", yandexRoutes);

  // Serve static assets / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
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
