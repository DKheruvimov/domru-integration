import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { validateModuleToken } from "./modules-manager.js";

let io: Server | null = null;
const connectedModules = new Map<string, string>(); // socket.id -> module.id

export function getConnectedModules() {
  return Array.from(new Set(connectedModules.values()));
}

export function dispatchModuleEvent(event: string, payload: any) {
  io?.emit(event, payload);
  io?.of("/modules").emit(event, payload);
}

export function notifyModuleViaWebSocket(moduleId: string, event: string, payload: any) {
  if (!io) return;
  const modulesNs = io.of("/modules");
  for (const [socketId, mId] of connectedModules.entries()) {
    if (mId === moduleId) {
      modulesNs.to(socketId).emit(event, payload);
    }
  }
}

export function disconnectModule(moduleId: string, code?: string, message?: string) {
  if (!io) return;
  const modulesNs = io.of("/modules");
  const sockets = Array.from(modulesNs.sockets.values());
  for (const s of sockets) {
    if (s.data.module?.id === moduleId) {
      console.log(`[WS/Modules] Force disconnecting module: ${moduleId}`);
      if (code || message) {
        s.emit("error", { code: code || "disabled", message: message || "Module is disabled" });
      }
      s.disconnect(true);
    }
  }
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
    },
    pingInterval: 5000,
    pingTimeout: 5000
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
    const moduleId = socket.handshake.auth?.moduleId || socket.handshake.query?.moduleId;
    const module = validateModuleToken(token as string);
    if (!module) {
      return next(new Error("Authentication error: invalid module token"));
    }
    
    // Check if the module is enabled in settings
    if (module.isEnabled === false) {
      return next(new Error("Authentication error: module is disabled in settings"));
    }
    
    // If the module token is claimed, require a matching moduleId from the client
    if (module.isClaimed) {
      if (!moduleId) {
        return next(new Error("Authentication error: token is claimed, but no moduleId was provided"));
      }
      if (moduleId !== module.id) {
        return next(new Error("Authentication error: moduleId mismatch"));
      }
    }
    
    socket.data.module = module;
    next();
  });

  modulesNs.on("connection", (socket) => {
    const module = socket.data.module;
    console.log(`[WS/Modules] Module connected: ${module.name} (${module.id})`);
    
    // Conflict resolution: if another socket is already connected for this module ID, disconnect the older one
    const existingSockets = Array.from(modulesNs.sockets.values());
    for (const s of existingSockets) {
      if (s.id !== socket.id && s.data.module?.id === module.id) {
        console.warn(`[WS/Modules] Duplicate connection detected for module ${module.name} (${module.id}). Disconnecting older socket: ${s.id}`);
        s.emit("error", { code: "duplicate_connection", message: "Another instance of this module has connected. Connection closed." });
        s.disconnect(true);
      }
    }

    connectedModules.set(socket.id, module.id);
    
    // Explicit dynamic status event from plugin
    socket.on("update_status", (payload: { status: "offline" | "warning" | "error" | "online", message?: string }) => {
      console.log(`[WS/Modules] Status update from ${module.name} (${module.id}): ${payload.status} - ${payload.message}`);
      import("./modules-manager.js").then(({ setModuleStatus }) => {
        setModuleStatus(module.id, payload.status, payload.message);
        // Broadcast the specific state change to all UI clients
        io?.emit("module_state_updated", {
          moduleId: module.id,
          status: payload.status,
          message: payload.message
        });
      });
    });

    io?.emit("modules_status_changed", getConnectedModules());

    socket.on("disconnect", () => {
      console.log(`[WS/Modules] Module disconnected: ${module.name} (${module.id})`);
      connectedModules.delete(socket.id);
      
      // Explicitly mark module as offline when socket disconnects
      import("./modules-manager.js").then(({ setModuleStatus }) => {
        // Only set offline if there are no other active connections for this module
        const stillConnected = Array.from(connectedModules.values()).includes(module.id);
        if (!stillConnected) {
          setModuleStatus(module.id, "offline", "Отключено от сервера");
          io?.emit("module_state_updated", {
            moduleId: module.id,
            status: "offline",
            message: "Отключено от сервера"
          });
        }
      });

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

export function broadcastCallEnded(login: string) {
  if (io) {
    io.emit("sip_call_ended", { login });
    
    // Notify external modules
    const payload = { login };
    io.of("/modules").emit("call_ended", payload);
    import("./modules-manager.js").then(m => m.dispatchModuleEvent("call_ended", payload));
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
