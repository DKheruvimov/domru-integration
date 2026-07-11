import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    let apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!apiBaseUrl && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      // Dynamically connect to api.domain.com if VITE_API_BASE_URL failed to inject
      const baseDomain = window.location.hostname.replace(/^api\./, "");
      apiBaseUrl = `https://api.${baseDomain}`;
    }
    const socketUrl = apiBaseUrl ? apiBaseUrl.replace(/^http/, "ws") : undefined;

    // Connect directly to the dedicated subdomain for WebSockets and API to bypass WAF if configured
    socket = io(socketUrl as any, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ["websocket", "polling"]
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
