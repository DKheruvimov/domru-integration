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

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
    loadAndResumeActiveTasks();
    initPermanentSipBindings();
  });
}

startServer();
