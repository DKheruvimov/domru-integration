import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Connect directly to the dedicated subdomain for WebSockets and API to bypass WAF
    socket = io("wss://api.kheruvimov.ru", {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ["websocket"]
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
