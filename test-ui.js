import { io } from "socket.io-client";

const socket = io("wss://api.kheruvimov.ru", {
  transports: ["websocket"]
});

socket.on("connect", () => {
  console.log("UI Client connected!");
  socket.emit("get_modules_status");
});

socket.on("modules_status_changed", (data) => {
  console.log("Received modules_status_changed:", data);
});

socket.on("module_state_updated", (data) => {
  console.log("Received module_state_updated:", data);
});

socket.on("module_schema_updated", (data) => {
  console.log("Received module_schema_updated:", data);
});
