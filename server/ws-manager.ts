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
      io.of("/modules").emit("incoming_call", {
        login,
        placeId,
        deviceId,
        snapshotUrl: `/api/domru/snapshot/${placeId}/${deviceId}?t=${Date.now()}`
      });
    }
  }
}

export function broadcastDoorOpened(deviceId: number, source: string, details: string) {
  if (io) {
    io.emit("door_opened", { deviceId, source, details });
    io.of("/modules").emit("door_opened", { deviceId, source, details });
  }
}
