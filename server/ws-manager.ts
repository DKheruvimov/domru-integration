import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { validateModuleToken } from "./modules-manager.js";

let io: Server | null = null;
const connectedModules = new Map<string, string>(); // socket.id -> module.id

export function getConnectedModules() {
  return Array.from(new Set(connectedModules.values()));
}

export function initWebSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1")) {
          callback(null, true);
        } else {
          callback(null, origin);
        }
      },
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    socket.emit("connected", { message: "Welcome to Dom.ru Intercom WebSocket" });
    socket.emit("modules_status_changed", getConnectedModules());

    socket.on("get_modules_status", () => {
      console.log(`[WS] Client ${socket.id} requested modules status. Sending:`, getConnectedModules());
      socket.emit("modules_status_changed", getConnectedModules());
    });

    socket.on("disconnect", () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  // External Modules Namespace
  const modulesNs = io.of("/modules");
  modulesNs.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const module = validateModuleToken(token as string);
    if (!module) {
      return next(new Error("Authentication error: invalid module token"));
    }
    socket.data.module = module;
    next();
  });

  modulesNs.on("connection", (socket) => {
    const module = socket.data.module;
    console.log(`[WS/Modules] Module connected: ${module.name} (${module.id})`);
    connectedModules.set(socket.id, module.id);
    
    io?.emit("modules_status_changed", getConnectedModules());

    socket.on("disconnect", () => {
      console.log(`[WS/Modules] Module disconnected: ${module.name} (${module.id})`);
      connectedModules.delete(socket.id);
      io?.emit("modules_status_changed", getConnectedModules());
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("WebSocket Server not initialized!");
  }
  return io;
}

export function broadcastAutoOpenStatusChanged() {
  if (io) {
    io.emit("auto_open_status_changed");
  }
}

export function broadcastSipLogAdded(log: any) {
  if (io) {
    io.emit("sip_log_added", log);
  }
}

export function broadcastIncomingCall(login: string, details?: string, placeId?: number, deviceId?: number) {
  if (io) {
    io.emit("sip_incoming_call", { login, details });
    
    // Notify external modules
    if (placeId && deviceId) {
      const payload = { login, placeId, deviceId };
      io.of("/modules").emit("incoming_call", payload);
      
      // Also dispatch to Webhook & Long Polling modules
      import("./modules-manager.js").then(m => m.dispatchModuleEvent("incoming_call", payload));
    }
  }
}

export function broadcastDoorOpened(deviceId: number, source: string, details: string) {
  const payload = { deviceId, source, details };
  if (io) {
    io.emit("door_opened", payload);
    io.of("/modules").emit("door_opened", payload);
  }
  // Dispatch to Webhook & Long Polling modules
  import("./modules-manager.js").then(m => m.dispatchModuleEvent("door_opened", payload));
}
