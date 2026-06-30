import { Server } from "socket.io";
import type { Server as HttpServer } from "http";

let io: Server | null = null;

export function initWebSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow same-origin requests (no origin header) and localhost for development
        if (!origin || origin.includes("localhost") || origin.includes("127.0.0.1")) {
          callback(null, true);
        } else {
          // In production, allow the request origin (same server)
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

export function broadcastIncomingCall(login: string, details?: string) {
  if (io) {
    io.emit("sip_incoming_call", { login, details });
  }
}

export function broadcastDoorOpened(deviceId: number, source: string, details: string) {
  if (io) {
    io.emit("door_opened", { deviceId, source, details });
  }
}
