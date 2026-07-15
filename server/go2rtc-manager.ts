import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import axios from "axios";
import { WebSocket, WebSocketServer } from "ws";

const GO2RTC_VERSION = "v1.9.8";
const BIN_DIR = path.join(process.cwd(), "bin");
const CONFIG_FILE = path.join(process.cwd(), "go2rtc.yaml");

// Detect OS and Architecture to choose the correct go2rtc binary
function getGo2RtcDownloadUrlAndFilename(): { url: string; filename: string } {
  const platform = process.platform;
  const arch = process.arch;

  let binaryName = "";
  if (platform === "win32") {
    binaryName = "go2rtc_win64.zip";
  } else if (platform === "darwin") {
    binaryName = arch === "arm64" ? "go2rtc_mac_arm64" : "go2rtc_mac_amd64";
  } else if (platform === "linux") {
    binaryName = arch === "arm64" ? "go2rtc_linux_arm64" : "go2rtc_linux_amd64";
  } else {
    throw new Error(`Unsupported platform for go2rtc: ${platform}`);
  }

  const url = `https://github.com/AlexxIT/go2rtc/releases/download/${GO2RTC_VERSION}/${binaryName}`;
  const filename = platform === "win32" ? "go2rtc.exe" : "go2rtc";
  return { url, filename };
}

let go2rtcProcess: ChildProcess | null = null;
let isShuttingDown = false;

/**
 * Downloads the go2rtc binary if it is not already present
 */
export async function downloadGo2Rtc(): Promise<string> {
  const { url, filename } = getGo2RtcDownloadUrlAndFilename();
  const binaryPath = path.join(BIN_DIR, filename);

  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  if (fs.existsSync(binaryPath)) {
    console.log(`[go2rtc-manager] go2rtc binary already exists at ${binaryPath}`);
    return binaryPath;
  }

  console.log(`[go2rtc-manager] go2rtc binary not found. Downloading from ${url}...`);
  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(binaryPath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", () => resolve());
      writer.on("error", (err) => reject(err));
    });

    // Make the binary executable on Unix/Mac systems
    if (process.platform !== "win32") {
      fs.chmodSync(binaryPath, 0o755);
    }

    console.log(`[go2rtc-manager] go2rtc binary successfully downloaded to ${binaryPath}`);
    return binaryPath;
  } catch (error) {
    console.error(`[go2rtc-manager] Failed to download go2rtc binary:`, error);
    throw error;
  }
}

/**
 * Creates a basic go2rtc configuration file if it doesn't exist
 */
function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_FILE)) {
    const configContent = `# go2rtc configuration
api:
  listen: "127.0.0.1:1984" # listen on localhost only for security
rtsp:
  listen: "0.0.0.0:8554"
webrtc:
  listen: "0.0.0.0:8555"
srtp:
  listen: "0.0.0.0:8443"
ffmpeg:
  bin: ffmpeg
  re: "-re -fflags nobuffer -flags low_delay -i {input}"
  hls_re: "-re -fflags nobuffer -flags low_delay -i {input}"
`;
    fs.writeFileSync(CONFIG_FILE, configContent, "utf8");
    console.log(`[go2rtc-manager] Created default go2rtc config at ${CONFIG_FILE}`);
  }
}

/**
 * Starts the go2rtc background process
 */
export async function startGo2Rtc(): Promise<void> {
  if (go2rtcProcess) {
    console.warn(`[go2rtc-manager] go2rtc is already running.`);
    return;
  }

  try {
    const binaryPath = await downloadGo2Rtc();
    ensureConfigFile();

    console.log(`[go2rtc-manager] Launching go2rtc daemon...`);
    go2rtcProcess = spawn(binaryPath, ["-config", CONFIG_FILE], {
      stdio: "pipe",
      cwd: process.cwd(),
    });

    go2rtcProcess.stdout?.on("data", (data) => {
      const text = data.toString().trim();
      if (text) {
        console.log(`[go2rtc] ${text}`);
      }
    });

    go2rtcProcess.stderr?.on("data", (data) => {
      const text = data.toString().trim();
      if (text) {
        console.warn(`[go2rtc-stderr] ${text}`);
      }
    });

    go2rtcProcess.on("exit", (code, signal) => {
      console.log(`[go2rtc-manager] go2rtc exited with code ${code}, signal ${signal}`);
      go2rtcProcess = null;

      // Auto-restart if not shutting down intentionally
      if (!isShuttingDown) {
        console.log(`[go2rtc-manager] Restarting go2rtc daemon in 3 seconds...`);
        setTimeout(() => startGo2Rtc(), 3000);
      }
    });

    // Cleanup process on main process exit
    process.on("exit", () => stopGo2Rtc());
    process.on("SIGINT", () => {
      stopGo2Rtc();
      process.exit();
    });
    process.on("SIGTERM", () => {
      stopGo2Rtc();
      process.exit();
    });

  } catch (error) {
    console.error(`[go2rtc-manager] Failed to start go2rtc:`, error);
  }
}

/**
 * Stops the running go2rtc background process
 */
export function stopGo2Rtc(): void {
  if (go2rtcProcess) {
    console.log(`[go2rtc-manager] Terminating go2rtc daemon...`);
    isShuttingDown = true;
    go2rtcProcess.kill("SIGTERM");
    go2rtcProcess = null;
  }
}

/**
 * Dynamically registers or updates a stream source in go2rtc
 * @param name The unique identifier for the stream (e.g. camera ID)
 * @param sourceUrl The source stream URL (RTSP/HLS/FLV, etc.)
 */
export async function registerStream(name: string, sourceUrl: string): Promise<boolean> {
  try {
    const response = await axios.put(
      `http://127.0.0.1:1984/api/streams?name=${encodeURIComponent(name)}&src=${encodeURIComponent(sourceUrl)}`
    );
    return response.status >= 200 && response.status < 300;
  } catch (error: any) {
    console.error(`[go2rtc-manager] Failed to register stream ${name}:`, error.message || error);
    return false;
  }
}

/**
 * Proxies a standard WebSocket connection from our Express server on Port 3000 to local go2rtc on Port 1984
 */
export function handleWsProxy(ws: WebSocket, reqUrl: string) {
  // Extract path and query parameters to forward
  // e.g., /api/go2rtc/ws?src=123 -> ws://127.0.0.1:1984/api/ws?src=123
  const urlObj = new URL(reqUrl, "http://localhost");
  const searchParams = urlObj.search;
  
  const targetWsUrl = `ws://127.0.0.1:1984/api/ws${searchParams}`;
  console.log(`[go2rtc-manager] Proxying WebSocket connection: ${reqUrl} -> ${targetWsUrl}`);

  const targetWs = new WebSocket(targetWsUrl);

  targetWs.on("open", () => {
    // Pipe data from client to go2rtc
    ws.on("message", (data, isBinary) => {
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(data, { binary: isBinary });
      }
    });
  });

  // Pipe data from go2rtc back to client
  targetWs.on("message", (data, isBinary) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data, { binary: isBinary });
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[go2rtc-manager] Client WebSocket closed (${code})`);
    targetWs.close();
  });

  targetWs.on("close", (code, reason) => {
    console.log(`[go2rtc-manager] target go2rtc WebSocket closed (${code})`);
    ws.close();
  });

  ws.on("error", (err) => {
    console.error(`[go2rtc-manager] Client WebSocket error:`, err);
    targetWs.close();
  });

  targetWs.on("error", (err) => {
    console.error(`[go2rtc-manager] target go2rtc WebSocket error:`, err);
    ws.close();
  });
}
