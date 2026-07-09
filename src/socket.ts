import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Connect to the same host/port the app is served from
    socket = io({
      transports: ["websocket"], // Disable HTTP polling to avoid WAF/DDoS bans
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on("connect", () => {
      console.log("[WS] Connected to backend");
    });

    socket.on("disconnect", () => {
      console.log("[WS] Disconnected from backend");
    });
  }
  return socket;
};
