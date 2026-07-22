import express from "express";
import axios from "axios";
import http from "http";
import https from "https";
import { spawn, execSync } from "child_process";
import { getAccountsByPhone, requestSmsCode, confirmSmsCode } from "../../src/domru-api/index.js";
import { tokenCache } from "../config.js";
import { streamToString, parseMpegTsCodecs } from "../mpegTsParser.js";
import { DomruClient } from "../../src/domru-api/index.js";
import {
  handleClientError,
  getDomruInstance,
  isDemo,
  normalizePhone,
  MOCK_PLACES,
  MOCK_DEVICES,
  MOCK_CAMERAS,
  MOCK_EVENTS,
} from "../domruClientHelper.js";
import { getProxiedStreamUrl } from "../yandexHelper.js";
import { registerStream } from "../go2rtc-manager.js";
import { enableAutoOpen, disableAutoOpen, disableAutoOpenByDevice, getSipLogs, getActiveTasks, handleManualOpen, getPermanentBindings } from "../sip-manager.js";
import { getPeople, savePeople, addTemporaryAutoOpenPerson, removeTemporaryAutoOpenPerson, isScheduleActive } from "../people-manager.js";
import { findSnapshotForEvent, getSnapshotPath } from "../snapshots-manager.js";
import { getOpeningByOurService } from "../openings-manager.js";
import { getSettings } from "../settings-manager.js";
import fs from "fs";
import { PORT } from "../config.js";

const router = express.Router();

// API Route: Authenticate
router.get("/debug-codec/:cameraId", async (req, res) => {
  const { cameraId } = req.params;
  if (isDemo(req)) {
    return res.json({
      isDemo: true,
      streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      codecs: ["PID 256: H.264 Video (0x1b)", "PID 257: AAC Audio (0x0f)"]
    });
  }

  try {
    const client = getDomruInstance(req);
    const stream = await client.getStreamUrl(cameraId);
    if (!stream || !stream.url) {
      return res.status(404).json({ error: "No stream URL found for camera" });
    }

    const originalUrl = stream.url;
    const proxiedPlaylistUrl = getProxiedStreamUrl(req, originalUrl, client);

    // Check if ffmpeg is installed and functional
    let ffmpegInstalled = false;
    let ffmpegVersion = "";
    try {
      ffmpegVersion = execSync("ffmpeg -version").toString().split("\n")[0];
      ffmpegInstalled = true;
    } catch (err: any) {
      ffmpegVersion = `Error: ${err.message}`;
    }

    // Fetch original codecs
    let originalCodecs: string[] = [];
    let originalPlaylistText = "";
    let originalFirstSegmentUrl = "";
    let originalFetchError = "";
    if (originalUrl.includes(".m3u8")) {
      try {
        const playListRes = await axios.get(originalUrl, {
          timeout: 5000,
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Authorization": client.token ? `Bearer ${client.token}` : "",
            "Operator": client.refreshData.operatorId ? String(client.refreshData.operatorId) : ""
          }
        });
        originalPlaylistText = playListRes.data;
        const lines = originalPlaylistText.split(/\r?\n/);
        let firstTsLine = lines.find(line => line.trim() && !line.trim().startsWith("#"));
        if (firstTsLine) {
          firstTsLine = firstTsLine.trim();
          originalFirstSegmentUrl = new URL(firstTsLine, originalUrl).toString();
          const tsRes = await axios.get(originalFirstSegmentUrl, {
            responseType: "arraybuffer",
            timeout: 8000,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Range": "bytes=0-150000",
              "Authorization": client.token ? `Bearer ${client.token}` : "",
              "Operator": client.refreshData.operatorId ? String(client.refreshData.operatorId) : ""
            }
          });
          originalCodecs = parseMpegTsCodecs(Buffer.from(tsRes.data));
        } else {
          originalFetchError = "No TS segment found in original playlist";
        }
      } catch (err: any) {
        originalFetchError = err.message || String(err);
      }
    } else {
      originalFetchError = `Stream is not HLS (type: ${stream.type})`;
    }

    // Fetch proxied codecs via local loopback to avoid DNS loopback issues in Docker
    const localBaseUrl = `http://127.0.0.1:${PORT}`;
    const relativePlaylistUrl = proxiedPlaylistUrl.replace(/https?:\/\/[^\/]+/, localBaseUrl);

    let proxiedPlaylistText = "";
    let proxiedFirstSegmentUrl = "";
    let proxiedCodecs: string[] = [];
    let transcodeError = "";

    try {
      const proxiedPlayListRes = await axios.get(relativePlaylistUrl, { timeout: 5000 });
      proxiedPlaylistText = proxiedPlayListRes.data;
      const lines = proxiedPlaylistText.split(/\r?\n/);
      let firstTsLine = lines.find(line => line.trim() && !line.trim().startsWith("#"));
      if (firstTsLine) {
        firstTsLine = firstTsLine.trim();
        const localSegmentUrl = firstTsLine.replace(/https?:\/\/[^\/]+/, localBaseUrl);
        proxiedFirstSegmentUrl = firstTsLine;

        const tsRes = await axios.get(localSegmentUrl, {
          responseType: "arraybuffer",
          timeout: 10000
        });
        proxiedCodecs = parseMpegTsCodecs(Buffer.from(tsRes.data));
      } else {
        transcodeError = "No TS segment found in proxied playlist";
      }
    } catch (err: any) {
      transcodeError = err.message || String(err);
    }

    res.json({
      type: stream.type,
      ffmpegInstalled,
      ffmpegVersion,
      originalUrl,
      proxiedPlaylistUrl,
      originalFirstSegmentUrl,
      proxiedFirstSegmentUrl,
      originalCodecs,
      proxiedCodecs,
      originalFetchError,
      transcodeError,
      originalPlaylistExcerpt: originalPlaylistText ? originalPlaylistText.substring(0, 500) : undefined,
      proxiedPlaylistExcerpt: proxiedPlaylistText ? proxiedPlaylistText.substring(0, 500) : undefined
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to debug codecs" });
  }
});

// API Route: Video Stream URL with CORS/MixedContent secure proxy wrapping
router.get("/stream/:cameraId", async (req, res) => {
  const { cameraId } = req.params;
  if (isDemo(req)) {
    return res.json({
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      type: "HLS",
    });
  }

  try {
    const client = getDomruInstance(req);
    const stream = await client.getStreamUrl(cameraId);
    if (stream && stream.url) {
      const originalUrl = stream.url;
      const proxiedUrl = getProxiedStreamUrl(req, originalUrl, client);

      console.log(`[STREAM_ROUTE] Generated secure authenticated proxy stream URL for Camera ${cameraId}`);
      res.json({
        url: proxiedUrl,
        type: stream.type,
        originalUrl: originalUrl
      });
    } else {
      res.json(stream);
    }
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Video Stream URL with automatic go2rtc registration and proxying
router.get("/stream-go2rtc/:cameraId", async (req, res) => {
  const { cameraId } = req.params;
  const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const wsProtocol = protocol === "https" ? "wss" : "ws";
  const hostHeader = req.headers.host || `localhost:${PORT}`;

  if (isDemo(req)) {
    const demoUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
    const success = await registerStream(cameraId, demoUrl);
    return res.json({
      success,
      cameraId,
      webrtcUrl: `${wsProtocol}://${hostHeader}/api/go2rtc/ws?src=${cameraId}`,
      mseUrl: `${wsProtocol}://${hostHeader}/api/go2rtc/ws?src=${cameraId}&media=mse`,
      hlsUrl: `${protocol}://${hostHeader}/api/domru/go2rtc-proxy/api/hls.m3u8?src=${cameraId}`,
      mjpegUrl: `${protocol}://${hostHeader}/api/domru/go2rtc-proxy/api/frame.mp4?src=${cameraId}`
    });
  }

  try {
    const client = getDomruInstance(req);
    const stream = await client.getStreamUrl(cameraId);
    if (stream && stream.url) {
      const originalUrl = stream.url;
      
      // Register our secure, authenticated proxy URL directly into go2rtc.
      // This bypasses CPU-heavy double-ffmpeg loops and prevents server OOM crashes
      // while ensuring the stream decryption keys and segments are fetched with proper authorization.
      const proxiedLoopbackUrl = `http://127.0.0.1:${PORT}/api/domru/stream-proxy/index.m3u8?url=${encodeURIComponent(originalUrl)}&token=${encodeURIComponent(client.token || "")}&operatorId=${encodeURIComponent(String(client.refreshData.operatorId || ""))}&transcode=false`;
      const go2rtcSource = `ffmpeg:${proxiedLoopbackUrl}#video=copy#audio=opus#input=hls_re`;
      
      const success = await registerStream(cameraId, go2rtcSource);
      
      console.log(`[go2rtc-route] Dynamically registered stream for Camera ${cameraId} via go2rtc FFmpeg source (Success: ${success})`);
      
      res.json({
        success,
        cameraId,
        webrtcUrl: `${wsProtocol}://${hostHeader}/api/go2rtc/ws?src=${cameraId}`,
        mseUrl: `${wsProtocol}://${hostHeader}/api/go2rtc/ws?src=${cameraId}&media=mse`,
        hlsUrl: `${protocol}://${hostHeader}/api/domru/go2rtc-proxy/api/hls.m3u8?src=${cameraId}`,
        mjpegUrl: `${protocol}://${hostHeader}/api/domru/go2rtc-proxy/api/frame.mp4?src=${cameraId}`,
        originalUrl: originalUrl
      });
    } else {
      res.status(404).json({ error: "No stream found for camera" });
    }
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: General HTTP proxy forwarding to local go2rtc (Port 1984) on Port 3000
router.all("/go2rtc-proxy*", (req, res) => {
  const subPath = req.url.replace(/^\/go2rtc-proxy/, "");
  
  const options: http.RequestOptions = {
    hostname: "127.0.0.1",
    port: 1984,
    path: subPath,
    method: req.method,
    headers: {}
  };

  Object.entries(req.headers).forEach(([key, val]) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey !== "host" &&
      lowerKey !== "connection" &&
      lowerKey !== "accept-encoding" &&
      lowerKey !== "content-length"
    ) {
      options.headers![key] = val;
    }
  });

  options.headers!["host"] = "127.0.0.1:1984";

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 200);
    Object.entries(proxyRes.headers).forEach(([key, val]) => {
      const lowerKey = key.toLowerCase();
      if (
        val !== undefined &&
        lowerKey !== "host" &&
        lowerKey !== "connection" &&
        lowerKey !== "content-encoding" &&
        lowerKey !== "transfer-encoding" &&
        lowerKey !== "content-length"
      ) {
        res.setHeader(key, val);
      }
    });

    proxyRes.pipe(res);

    proxyRes.on("error", (err) => {
      console.error(`[go2rtc-proxy] Response stream error for ${subPath}:`, err.message);
    });
  });

  proxyReq.on("error", (err) => {
    console.error(`[go2rtc-proxy] Request connection error for ${subPath}:`, err.message);
    if (!res.headersSent) {
      res.status(500).send(`go2rtc Proxy error: ${err.message}`);
    }
  });

  req.on("close", () => {
    proxyReq.destroy();
  });

  if (req.method !== "GET" && req.method !== "HEAD") {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Support OPTIONS on the stream-proxy for preflight requests
router.options("/stream-proxy*", (req, res) => {
  const origin = req.headers.origin || "https://yastatic.net";
  res.setHeader("Access-Control-Allow-Origin", origin);
  if (req.headers.origin) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "*");
  res.sendStatus(200);
});

function isAllowedStreamUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();

    // Block private/internal IP ranges and cloud metadata IPs
    if (
      hostname === "169.254.169.254" ||
      hostname.startsWith("127.") ||
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      // Allow local go2rtc / proxy ONLY if on expected ports (e.g., 1984, 8554, 8555, 3000, 3100)
      if ((hostname === "127.0.0.1" || hostname === "localhost") && ["1984", "8554", "8555", "3000", "3100"].includes(parsed.port)) {
        return true;
      }
      return false;
    }

    // Allow known Dom.ru / Er-Telecom video streaming domains
    if (
      hostname.endsWith(".ertelecom.ru") ||
      hostname.endsWith(".domru.ru") ||
      hostname.endsWith(".er-telecom.ru") ||
      hostname.endsWith(".ertelecom.net")
    ) {
      return true;
    }

    // Check against dynamically configured customDomain from settings (including subdomains)
    try {
      const settings = getSettings();
      if (settings && settings.customDomain) {
        const customParsed = new URL(settings.customDomain.startsWith("http") ? settings.customDomain : `https://${settings.customDomain}`);
        const customHost = customParsed.hostname.toLowerCase();
        if (hostname === customHost || hostname.endsWith(`.${customHost}`)) {
          return true;
        }
      }
    } catch (e) {}


    return false;
  } catch (e) {
    return false;
  }
}

// API Route: CORS/MixedContent secure proxy for domestic HLS/M3U8 streams
router.get("/stream-proxy*", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("Parameter 'url' is required.");
  }

  if (!isAllowedStreamUrl(targetUrl)) {
    return res.status(403).json({ error: "Access denied: target URL is not in the allowed stream domain list" });
  }

  // Extract auth parameters for downstream requests (e.g., segment key decryptions or sub-playlists)
  let login = (req.query.login as string) || (req.headers["x-domru-login"] as string) || "";
  let password = (req.query.password as string) || (req.headers["x-domru-password"] as string) || "";
  let token = (req.query.token as string) || (req.headers["x-domru-token"] as string) || "";
  let operatorId = (req.query.operatorId as string) || (req.headers["x-domru-operator-id"] as string) || "";
  let refreshToken = (req.query.refreshToken as string) || (req.headers["x-domru-refresh-token"] as string) || "";

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    try {
      const b64 = req.headers.authorization.split(" ")[1];
      const decoded = JSON.parse(decodeURIComponent(atob(b64)));
      login = decoded.login || login;
      password = decoded.password || password;
      token = decoded.token || token;
      refreshToken = decoded.refreshToken || refreshToken;
      operatorId = decoded.operatorId || operatorId;
    } catch (e) {
      console.error("Failed to decode Authorization header in streamRoutes:", e);
    }
  }

  // Set explicit CORS headers dynamically to support credentials-based requests and match Yandex specifications
  const origin = req.headers.origin || "https://yastatic.net";
  res.setHeader("Access-Control-Allow-Origin", origin);
  if (req.headers.origin) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "*");

  // Disable Nginx proxy buffering for real-time video streaming to prevent segment delivery delays
  res.setHeader("X-Accel-Buffering", "no");

  // Resolve token cache if available
  const cacheKey = login || refreshToken || "";
  let currentToken = token;
  if (cacheKey && tokenCache.has(cacheKey)) {
    const cached = tokenCache.get(cacheKey)!;
    if (Date.now() < cached.expiresAt) {
      currentToken = cached.token;
    }
  }

  // AbortController to cancel downstream request if client closes connection
  const abortController = new AbortController();
  req.on("close", () => {
    console.log(`[STREAM_PROXY] Client disconnected, aborting target fetch: ${targetUrl}`);
    abortController.abort();
  });

  let attempts = 0;
  let axiosResponse: any = null;

  try {
    while (attempts < 2) {
      const requestHeaders: Record<string, string> = {
        "User-Agent": (req.headers["user-agent"] as string) || "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        "Accept": (req.headers["accept"] as string) || "*/*"
      };

      const isM3u8 = targetUrl.includes(".m3u8") || 
                     targetUrl.includes("manifest") || 
                     targetUrl.includes("playlist");

      if (req.headers["range"]) {
        requestHeaders["Range"] = req.headers["range"] as string;
      } else if (!isM3u8) {
        // Default to bytes=0- for segments / video streams to satisfy Domru camera requirements and prevent ECONNRESET
        requestHeaders["Range"] = "bytes=0-";
      }
      if (req.headers["if-range"]) {
        requestHeaders["If-Range"] = req.headers["if-range"] as string;
      }

      // Add Authorization and Operator headers if request target is a Domru / Proptech site (important for decryption keys!)
      const isDomruDomain = targetUrl.includes("proptech.ru") || targetUrl.includes("domru.ru") || targetUrl.includes("ertelecom.ru");
      if (isDomruDomain) {
        if (currentToken) {
          requestHeaders["Authorization"] = `Bearer ${currentToken}`;
        }
        if (operatorId) {
          requestHeaders["Operator"] = String(operatorId);
        }
      }

      console.log(`[STREAM_PROXY] Fetching target (attempt ${attempts + 1}): ${targetUrl} (isDomruDomain=${isDomruDomain}, Range=${requestHeaders["Range"] || 'none'})`);
      
      axiosResponse = await axios({
        method: "get",
        url: targetUrl,
        headers: requestHeaders,
        responseType: "stream",
        validateStatus: () => true,
        signal: abortController.signal,
        timeout: 10000,
        httpsAgent: isDomruDomain ? new https.Agent({ rejectUnauthorized: false }) : undefined,
      });

      console.log(`[STREAM_PROXY] Remote Response Status: ${axiosResponse.status} ${axiosResponse.statusText}`);

      // If unauthorized (401) and we have credentials, try to refresh the token and retry
      if (axiosResponse.status === 401 && (login || password || refreshToken) && attempts === 0) {
        console.log(`[STREAM_PROXY] Received 401 from remote server, attempting to refresh token...`);
        try {
          const client = new DomruClient({
            login,
            password,
            refreshToken,
            operatorId: operatorId ? Number(operatorId) : undefined,
            timeout: 10000,
          });
          await client.authenticate();
          if (client.token) {
            currentToken = client.token;
            if (cacheKey) {
              tokenCache.set(cacheKey, {
                token: client.token,
                expiresAt: Date.now() + 50 * 60 * 1000, // 50 minutes cache
              });
            }
            console.log(`[STREAM_PROXY] Token refreshed successfully (length: ${currentToken.length})`);
            attempts++;
            continue;
          }
        } catch (refreshErr) {
          console.error(`[STREAM_PROXY] Failed to refresh token:`, refreshErr);
        }
      }

      break;
    }

    // 200 OK or 206 Partial Content are both valid success codes
    if (axiosResponse.status !== 200 && axiosResponse.status !== 206) {
      console.error(`[STREAM_PROXY] Error response from remote server: ${axiosResponse.status}`);
      return res.status(axiosResponse.status).send(`Stream request failed: ${axiosResponse.statusText || 'Error'}`);
    }

    // Attach error listener to prevent uncaughtExceptions during async piping or reading
    axiosResponse.data.on("error", (err: any) => {
      console.error("[STREAM_PROXY] axiosResponse.data stream error (likely safe/expected on client disconnect):", err.message || err);
    });

    const contentType = String(axiosResponse.headers["content-type"] || "").toLowerCase();
    console.log(`[STREAM_PROXY] Remote Content-Type: ${contentType}`);

    const isM3u8 = targetUrl.includes(".m3u8") || 
                   contentType.includes("mpegurl") || 
                   contentType.includes("x-mpegurl") ||
                   contentType.includes("application/vnd.apple.mpegurl") ||
                   contentType.includes("application/x-mpegurl");

    const isTs = targetUrl.includes(".ts") || 
                 targetUrl.endsWith(".ts") ||
                 contentType.includes("mp2t") || 
                 contentType.includes("video/mp2t");

    // Forward correct HTTP Status Code
    // If it's a TS segment, we force 200 OK because we strip content-length and range headers to transcode the audio on the fly
    if (isTs) {
      res.status(200);
    } else {
      res.status(axiosResponse.status);
    }

    // Copy key headers from remote response to client response
    const headersToForward = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "expires",
      "pragma",
      "last-modified",
      "etag"
    ];

    const isLiveStream = contentType.includes("flv") || 
                         contentType.includes("mjpeg") || 
                         targetUrl.includes("mjpeg") ||
                         targetUrl.includes("/rtsp/");

    for (const h of headersToForward) {
      // Exclude content-length for M3U8 files as we will modify the content length by rewriting URLs
      if (isM3u8 && h === "content-length") {
        continue;
      }
      // Exclude content-type, content-length, content-range, and accept-ranges for TS files
      // as transcoding on the fly invalidates the original range metadata and changes segment size.
      if (isTs && (h === "content-type" || h === "content-length" || h === "content-range" || h === "accept-ranges")) {
        continue;
      }
      // Exclude range and length headers for live streams to prevent connection drops and seeking issues
      if (isLiveStream && (h === "content-length" || h === "content-range" || h === "accept-ranges")) {
        continue;
      }
      const val = axiosResponse.headers[h];
      if (val !== undefined && val !== null) {
        res.setHeader(h, String(val));
      }
    }

    if (isM3u8) {
      // Force correct M3U8 content-type just in case
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      
      const text = await streamToString(axiosResponse.data);
      console.log(`[STREAM_PROXY] Content looks like M3U8. First 150 chars:\n${text.substring(0, 150)}`);
      const lines = text.split(/\r?\n/);
      const hostHeader = req.headers.host || `localhost:${PORT}`;
      const protocol = (req.secure || req.headers["x-forwarded-proto"] === "https" || (!hostHeader.includes("localhost") && !hostHeader.includes("127.0.0.1"))) ? "https" : "http";

      // Assemble auth headers as query options to propagate credentials to subsegments / subresources
      let authParams = "";
      if (login) authParams += `&login=${encodeURIComponent(login)}`;
      if (password) authParams += `&password=${encodeURIComponent(password)}`;
      if (currentToken) authParams += `&token=${encodeURIComponent(currentToken)}`; // Use refreshed/current token!
      if (operatorId) authParams += `&operatorId=${encodeURIComponent(operatorId)}`;
      if (refreshToken) authParams += `&refreshToken=${encodeURIComponent(refreshToken)}`;
      
      const transcodeVal = req.query.transcode as string;
      if (transcodeVal !== undefined) {
        authParams += `&transcode=${encodeURIComponent(transcodeVal)}`;
      }

      const rewrittenLines = lines.map(line => {
        let trimmed = line.trim();
        if (!trimmed) {
          return line;
        }

        // Case 1: Standard media segment / playlist referenced directly (does not start with '#')
        if (!trimmed.startsWith("#")) {
          try {
            const resolved = new URL(trimmed, targetUrl).toString();
            let filename = "segment.ts";
            try {
              const parsed = new URL(resolved);
              const last = parsed.pathname.substring(parsed.pathname.lastIndexOf("/") + 1);
              if (last) {
                filename = last;
              }
            } catch {}
            return `${protocol}://${hostHeader}/api/domru/stream-proxy/${filename}?url=${encodeURIComponent(resolved)}${authParams}`;
          } catch {
            return trimmed;
          }
        }

        // Case 3: Rewrite codecs in stream info tag to declare AAC instead of MP3, and guarantee an audio codec
        if (trimmed.startsWith("#EXT-X-STREAM-INF:")) {
          if (trimmed.includes("CODECS=")) {
            trimmed = trimmed.replace(/CODECS="([^"]+)"/g, (match, codecsAttr) => {
              const codecs = codecsAttr.split(",").map(c => c.trim());
              let hasAudio = false;
              const updatedCodecs = codecs.map(c => {
                const lower = c.toLowerCase();
                if (lower.includes("mp3") || lower.includes("mp4a") || lower.includes("aac")) {
                  hasAudio = true;
                  return "mp4a.40.2"; // Force AAC-LC
                }
                return c;
              });
              if (!hasAudio) {
                updatedCodecs.push("mp4a.40.2");
              }
              return `CODECS="${updatedCodecs.join(",")}"`;
            });
          } else {
            trimmed += ',CODECS="avc1.4d401f,mp4a.40.2"';
          }
        }

        // Case 2: Tag lines specifying a subresource URI (e.g. encryption keys, e.g. URI="...")
        if (trimmed.includes("URI=")) {
          trimmed = trimmed.replace(/URI="([^"]+)"/g, (match, p1) => {
            try {
              const resolved = new URL(p1, targetUrl).toString();
              let filename = "key.key";
              try {
                const parsed = new URL(resolved);
                const last = parsed.pathname.substring(parsed.pathname.lastIndexOf("/") + 1);
                if (last) {
                  filename = last;
                }
              } catch {}
              const proxied = `${protocol}://${hostHeader}/api/domru/stream-proxy/${filename}?url=${encodeURIComponent(resolved)}${authParams}`;
              return `URI="${proxied}"`;
            } catch {
              return match;
            }
          });
        }

        return trimmed;
      });

      res.send(rewrittenLines.join("\n"));
    } else {
      const transcodeQuery = req.query.transcode;
      const isRawQuery = req.query.raw === "true";
      const shouldTranscode = isTs && transcodeQuery !== "false" && !isRawQuery;

      if (shouldTranscode) {
        // Force correct content-type for TS segments
        res.setHeader("Content-Type", "video/mp2t");

        const chunks: Buffer[] = [];
        let segmentBuffer: Buffer | null = null;

        try {
          // Buffer the TS segment data to inspect and parse its codecs
          for await (const chunk of axiosResponse.data) {
            chunks.push(chunk);
          }
          segmentBuffer = Buffer.concat(chunks);

          const codecs = parseMpegTsCodecs(segmentBuffer);
          const hasAudio = codecs.some(c => c.toLowerCase().includes("audio"));
          console.log(`[STREAM_PROXY] Segment codecs: [${codecs.join(", ")}], hasAudio=${hasAudio}`);

          let ffmpegArgs: string[] = [];

          if (hasAudio) {
            // Input has audio stream: copy video track and transcode audio to AAC
            ffmpegArgs = [
              "-loglevel", "warning",
              "-copyts",
              "-avoid_negative_ts", "disabled",
              "-f", "mpegts",
              "-probesize", "5000000",
              "-analyzeduration", "5000000",
              "-i", "pipe:0",
              "-map", "0:v",
              "-map", "0:a",
              "-c:v", "copy",
              "-c:a", "aac",
              "-b:a", "128k",
              "-af", "aresample=async=1",
              "-f", "mpegts",
              "-muxdelay", "0",
              "pipe:1"
            ];
          } else {
            // Input has no audio: merge with a silent audio stream (anullsrc) to prevent players failing
            // NOTE: we do NOT use -copyts here because anullsrc generates PTS from 0
            // while the video segment has an arbitrary PTS offset — mixing them with -copyts
            // would produce a huge gap that breaks HLS segment continuity.
            ffmpegArgs = [
              "-loglevel", "warning",
              "-f", "lavfi",
              "-i", "anullsrc=channel_layout=mono:sample_rate=8000",
              "-f", "mpegts",
              "-probesize", "5000000",
              "-analyzeduration", "5000000",
              "-i", "pipe:0",
              "-map", "1:v",
              "-map", "0:a",
              "-c:v", "copy",
              "-c:a", "aac",
              "-b:a", "64k",
              "-shortest",
              "-f", "mpegts",
              "-muxdelay", "0",
              "pipe:1"
            ];
          }

          const ffmpeg = spawn("ffmpeg", ffmpegArgs);

          let closed = false;
          const cleanup = () => {
            if (!closed) {
              closed = true;
              try {
                ffmpeg.kill("SIGKILL");
              } catch {}
            }
          };

          // Protect from uncaughtExceptions on helper streams (broken pipe EPIPE errors)
          if (ffmpeg.stdin) {
            ffmpeg.stdin.on("error", (err: any) => {
              console.error("[STREAM_PROXY] ffmpeg.stdin error (likely broken pipe EPIPE, safe to ignore):", err.message || err);
            });
          }
          if (ffmpeg.stdout) {
            ffmpeg.stdout.on("error", (err: any) => {
              console.error("[STREAM_PROXY] ffmpeg.stdout error:", err.message || err);
            });
          }
          if (ffmpeg.stderr) {
            ffmpeg.stderr.on("error", (err: any) => {
              console.error("[STREAM_PROXY] ffmpeg.stderr error:", err.message || err);
            });
          }

          ffmpeg.stderr.on("data", (data) => {
            console.error(`[STREAM_PROXY_FFMPEG] ${data.toString().trim()}`);
          });

          ffmpeg.on("error", (err) => {
            console.error("[STREAM_PROXY] Failed to spawn ffmpeg:", err);
            cleanup();
            if (!res.headersSent && !res.destroyed && res.writable) {
              try {
                if (segmentBuffer) {
                  res.send(segmentBuffer);
                } else {
                  res.status(500).send("Fallback buffer empty on spawn error");
                }
              } catch (sendErr) {
                console.error("[STREAM_PROXY] Error sending fallback segmentBuffer after error:", sendErr);
              }
            }
          });

          ffmpeg.on("exit", () => cleanup());
          req.on("close", () => cleanup());
          res.on("error", () => cleanup());

          // Write buffered data to ffmpeg stdin and pipe stdout to client response
          if (ffmpeg.stdin && ffmpeg.stdin.writable && segmentBuffer) {
            try {
              ffmpeg.stdin.write(segmentBuffer, (err) => {
                if (err) {
                  console.error("[STREAM_PROXY] ffmpeg.stdin.write callback error:", err);
                }
                try {
                  ffmpeg.stdin.end();
                } catch (e) {}
              });
            } catch (writeErr) {
              console.error("[STREAM_PROXY] Error writing to ffmpeg.stdin:", writeErr);
              try {
                ffmpeg.stdin.end();
              } catch (e) {}
            }
          }
          if (ffmpeg.stdout) {
            ffmpeg.stdout.pipe(res);
          }
        } catch (spawnErr) {
          console.error("[STREAM_PROXY] Error initiating transcoding:", spawnErr);
          if (!res.headersSent && !res.destroyed && res.writable) {
            try {
              if (segmentBuffer && segmentBuffer.length > 0) {
                res.send(segmentBuffer);
              } else if (chunks.length > 0) {
                res.send(Buffer.concat(chunks));
              } else {
                res.status(500).send("Transcoding exception fallback failed");
              }
            } catch (pipeErr) {
              console.error("[STREAM_PROXY] Error sending fallback data on spawn exception:", pipeErr);
            }
          }
        }
      } else {
        // High-speed low-latency stream-through chunk bypass using Node.js stream pipe
        axiosResponse.data.pipe(res);
      }
    }
  } catch (err: any) {
    console.error("[STREAM_PROXY] Error fetching target stream url:", targetUrl, err);
    res.status(500).send(`CORS Gateway stream failure: ${err.message || err}. Target: ${targetUrl}. Stack: ${err.stack || "No stack"}`);
  }
});

// API Route: Open Intercom Door/Gate
export default router;
