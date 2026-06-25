import express from "express";
import axios from "axios";
import { spawn, execSync } from "child_process";
import { getAccountsByPhone, requestSmsCode, confirmSmsCode } from "../../src/domru-js/index.js";
import { tokenCache } from "../config.js";
import { streamToString, parseMpegTsCodecs } from "../mpegTsParser.js";
import { DomruClient } from "../../src/domru-js/index.js";
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
import { enableAutoOpen, disableAutoOpen, disableAutoOpenByDevice, getSipLogs, getActiveTasks, handleManualOpen, getPermanentBindings } from "../sip-manager.js";
import { getPeople, savePeople, addTemporaryAutoOpenPerson, removeTemporaryAutoOpenPerson, isScheduleActive } from "../people-manager.js";

const router = express.Router();

// API Route: Authenticate
router.post("/login", async (req, res) => {
  if (isDemo(req)) {
    return res.json({
      success: true,
      token: "demo-access-token-123",
      refreshData: {
        refreshToken: "demo-refresh-token-456",
        operatorId: 123,
      },
    });
  }

  try {
    const client = getDomruInstance(req);
    await client.authenticate();
    res.json({
      success: true,
      token: client.token,
      refreshData: client.refreshData,
    });
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: SMS Accounts Fetch
router.post("/sms/accounts", async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: "Необходим номер телефона" });
  }

  const cleanPhone = normalizePhone(phone);

  if (isDemo(req)) {
    return res.json([
      {
        operatorId: 123,
        subscriberId: 111111,
        accountId: "demo_acc_1",
        placeId: 1001,
        address: "ул. Ленина, д. 10, кв. 42 (Песочница)",
        profileId: "demo_profile_1"
      },
      {
        operatorId: 123,
        subscriberId: 222222,
        accountId: "demo_acc_2",
        placeId: 1002,
        address: "ул. Гагарина, д. 5, кв. 7 (Песочница)",
        profileId: "demo_profile_2"
      }
    ]);
  }

  try {
    const accounts = await getAccountsByPhone(cleanPhone);
    res.json(accounts);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Send SMS code
router.post("/sms/request", async (req, res) => {
  const { phone, account } = req.body;
  if (!phone || !account) {
    return res.status(400).json({ error: "Необходимы номер телефона и аккаунт" });
  }

  const cleanPhone = normalizePhone(phone);

  if (isDemo(req)) {
    return res.json({ success: true, message: "Код отправлен (Имитация)" });
  }

  try {
    const success = await requestSmsCode(cleanPhone, account);
    res.json({ success });
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Confirm SMS code
router.post("/sms/confirm", async (req, res) => {
  const { phone, code, account } = req.body;
  if (!phone || !code || !account) {
    return res.status(400).json({ error: "Необходимы номер телефона, код подтверждения и аккаунт" });
  }

  const cleanPhone = normalizePhone(phone);

  if (isDemo(req)) {
    if (code === "0000" || code === "1234" || code === "5555" || code.length === 4) {
      return res.json({
        success: true,
        token: "demo-access-token-123",
        refreshData: {
          refreshToken: "demo-refresh-token-456",
          operatorId: account.operatorId || 123,
        },
      });
    } else {
      return res.status(400).json({ error: "Неверный код (В режиме демо введите любой 4-значный код)" });
    }
  }

  try {
    const response = await confirmSmsCode(cleanPhone, code, account);
    res.json({
      success: true,
      token: response.accessToken,
      refreshData: {
        refreshToken: response.refreshToken,
        operatorId: response.operatorId,
      },
    });
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Subscriber Places
router.get("/places", async (req, res) => {
  if (isDemo(req)) {
    return res.json(MOCK_PLACES);
  }

  try {
    const client = getDomruInstance(req);
    const places = await client.getSubscriberPlaces();
    res.json(places);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Devices
router.get("/devices/:placeId", async (req, res) => {
  const placeId = Number(req.params.placeId);
  if (isDemo(req)) {
    const devices = (MOCK_DEVICES as any)[placeId] || [];
    return res.json(devices);
  }

  try {
    const client = getDomruInstance(req);
    const devices = await client.getDevices(placeId);
    res.json(devices);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Cameras
router.get("/cameras", async (req, res) => {
  if (isDemo(req)) {
    return res.json(MOCK_CAMERAS);
  }

  try {
    const client = getDomruInstance(req);
    const cameras = await client.getCameras();
    res.json(cameras);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Debug stream codecs
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
    const localBaseUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;
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

// API Route: CORS/MixedContent secure proxy for domestic HLS/M3U8 streams
router.get("/stream-proxy*", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("Parameter 'url' is required.");
  }

  // Extract auth parameters for downstream requests (e.g., segment key decryptions or sub-playlists)
  const login = (req.query.login as string) || (req.headers["x-domru-login"] as string) || "";
  const password = (req.query.password as string) || (req.headers["x-domru-password"] as string) || "";
  const token = (req.query.token as string) || (req.headers["x-domru-token"] as string) || "";
  const operatorId = (req.query.operatorId as string) || (req.headers["x-domru-operator-id"] as string) || "";
  const refreshToken = (req.query.refreshToken as string) || (req.headers["x-domru-refresh-token"] as string) || "";

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
            console.log(`[STREAM_PROXY] Token refreshed successfully: ${currentToken}`);
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
      const hostHeader = req.headers.host || "localhost:3000";
      const protocol = (req.secure || req.headers["x-forwarded-proto"] === "https" || (!hostHeader.includes("localhost") && !hostHeader.includes("127.0.0.1"))) ? "https" : "http";

      // Assemble auth headers as query options to propagate credentials to subsegments / subresources
      let authParams = "";
      if (login) authParams += `&login=${encodeURIComponent(login)}`;
      if (password) authParams += `&password=${encodeURIComponent(password)}`;
      if (currentToken) authParams += `&token=${encodeURIComponent(currentToken)}`; // Use refreshed/current token!
      if (operatorId) authParams += `&operatorId=${encodeURIComponent(operatorId)}`;
      if (refreshToken) authParams += `&refreshToken=${encodeURIComponent(refreshToken)}`;

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
      if (isTs) {
        // Force correct content-type for TS segments
        res.setHeader("Content-Type", "video/mp2t");

        try {
          // Buffer the TS segment data to inspect and parse its codecs
          const chunks: Buffer[] = [];
          for await (const chunk of axiosResponse.data) {
            chunks.push(chunk);
          }
          const segmentBuffer = Buffer.concat(chunks);

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
            if (!res.headersSent) {
              res.send(segmentBuffer);
            }
          });

          ffmpeg.on("exit", () => cleanup());
          req.on("close", () => cleanup());
          res.on("error", () => cleanup());

          // Write buffered data to ffmpeg stdin and pipe stdout to client response
          if (ffmpeg.stdin && ffmpeg.stdin.writable) {
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
          if (!res.headersSent) {
            axiosResponse.data.pipe(res);
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
router.get("/snapshot/:placeId/:deviceId", async (req, res) => {
  const { placeId, deviceId } = req.params;
  if (isDemo(req)) {
    try {
      const dummyResponse = await fetch("https://picsum.photos/640/360");
      const buffer = await dummyResponse.arrayBuffer();
      res.setHeader("Content-Type", "image/jpeg");
      return res.send(Buffer.from(buffer));
    } catch {
      return res.status(500).send("Demo image error");
    }
  }

  try {
    const client = getDomruInstance(req);
    const snapshot = await client.getSnapshot(Number(placeId), Number(deviceId));
    if (!snapshot) {
      return res.status(404).send("Snapshot failed or not available");
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Length", snapshot.length);
    res.send(Buffer.from(snapshot));
  } catch (err: any) {
    console.error("Failed to fetch camera snapshot:", err);
    res.status(500).send(err.message || "Failed to fetch camera snapshot");
  }
});

// API Route: Open Intercom Door/Gate
router.post("/open", async (req, res) => {
  const { placeId, deviceId } = req.body;
  if (isDemo(req)) {
    return res.json({
      status: "SUCCESS",
      message: "Дверь успешно открыта",
    });
  }

  try {
    const client = getDomruInstance(req);
    await handleManualOpen(Number(placeId), Number(deviceId), client);
    res.json({ status: "SUCCESS", message: "Дверь открыта (SIP interception applied if ringing)" });
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Get SIP Logs
router.get("/sip/logs", (req, res) => {
  res.json(getSipLogs());
});

// API Route: Get SIP Auto Open Status
router.get("/sip/auto-open/status", (req, res) => {
  const activeTasks = getActiveTasks();
  const status: Record<number, number | boolean> = {};
  for (const task of activeTasks) {
    status[task.deviceId] = task.expiresAt;
  }

  // Check if we have active guests or couriers currently scheduled
  try {
    const people = getPeople();
    const activeGuest = people.find(p => p.role !== "resident" && isScheduleActive(p));
    if (activeGuest) {
      // Find all device IDs that we have permanent bindings for, and set status to true
      const bindings = getPermanentBindings();
      
      for (const binding of bindings) {
        if (!status[binding.deviceId]) {
          status[binding.deviceId] = true;
        }
      }
      
      // Fallback: also enable for mock devices so they light up in the frontend camera view immediately
      const allMockDevices = Object.values(MOCK_DEVICES).flat();
      for (const dev of allMockDevices) {
        if (!status[dev.id]) {
          status[dev.id] = true;
        }
      }
    }
  } catch (err) {
    console.error("Error updating auto-open status from schedules:", err);
  }

  res.json(status);
});

// API Route: Toggle SIP Courier Auto Open
router.post("/sip/auto-open", async (req, res) => {
  const { placeId, deviceId, enabled, durationMinutes, maxOpens } = req.body;
  
  if (enabled) {
    addTemporaryAutoOpenPerson(Number(deviceId), maxOpens || null, durationMinutes || 60);
  } else {
    removeTemporaryAutoOpenPerson(Number(deviceId));
  }

  if (isDemo(req)) {
    return res.json({ status: "SUCCESS", message: enabled ? "Включено авто-открытие (Demo)" : "Отключено" });
  }

  try {
    const client = getDomruInstance(req);

    if (enabled) {
      const { randomBytes } = await import("crypto");
      const installationId = randomBytes(16).toString("hex");
      const credentials = await client.getSipCredentials(Number(placeId), Number(deviceId), installationId);
      
      const expiresAt = Date.now() + (durationMinutes ? durationMinutes * 60 * 1000 : 60 * 60 * 1000);
      
      const ctx = (client as any).ctx;
      const domruCredentials = {
        login: ctx?.login,
        password: ctx?.password,
        refreshToken: ctx?.refreshToken,
        operatorId: ctx?.operatorId,
        accessToken: ctx?.accessToken,
      };

      enableAutoOpen({
        placeId: Number(placeId),
        deviceId: Number(deviceId),
        credentials,
        expiresAt,
        maxOpens: typeof maxOpens === "number" ? maxOpens : null,
        domruCredentials,
        onOpenDoor: async () => {
          await client.openDoor(Number(placeId), Number(deviceId));
        }
      });
      res.json({ status: "SUCCESS", message: "SIP Auto-open enabled", login: credentials.login, expiresAt });
    } else {
      const { login } = req.body;
      if (login) disableAutoOpen(login);
      else disableAutoOpenByDevice(Number(deviceId));
      res.json({ status: "SUCCESS", message: "SIP Auto-open disable signal sent" });
    }
  } catch (err: any) {
    import("../sip-manager.js").then(m => m.addSipLog(`[SIP] API Error: ${err.message || err}`, "error")).catch(() => {});
    handleClientError(err, res);
  }
});

// API Route: Historical Events
router.post("/events", async (req, res) => {
  const { placeIds, page, sort } = req.body;
  if (isDemo(req)) {
    return res.json(MOCK_EVENTS);
  }

  try {
    const client = getDomruInstance(req);
    const events = await client.getEvents(placeIds, page, sort);
    res.json(events);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Guest Temporal PIN codes
router.post("/temporal", async (req, res) => {
  const { deviceIds } = req.body;
  if (isDemo(req)) {
    return res.json([
      {
        id: 301,
        deviceId: deviceIds[0] || 2001,
        code: "3810",
        name: "Курьер Самокат",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 302,
        deviceId: deviceIds[0] || 2001,
        code: "9552",
        name: "Друзья",
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      },
    ]);
  }

  try {
    const client = getDomruInstance(req);
    const codes = await client.getTemporalCodes(deviceIds);
    res.json(codes);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Route: Subscriber Finances
router.get("/finances", async (req, res) => {
  if (isDemo(req)) {
    return res.json({
      balance: 350.0,
      paymentPeriod: "до 25.06.2026",
      accountNumber: "278104829",
    });
  }

  try {
    const client = getDomruInstance(req);
    const finances = await client.getFinances();
    res.json(finances);
  } catch (err: any) {
    handleClientError(err, res);
  }
});

// API Routes: People Schedules
router.get("/people", (req, res) => {
  try {
    res.json(getPeople());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/people", (req, res) => {
  try {
    const { people } = req.body;
    if (Array.isArray(people)) {
      const oldPeople = getPeople();
      savePeople(people);

      // Detect deleted temporary cards to clean up active SIP tasks
      const newIds = new Set(people.map((p: any) => p.id));
      for (const oldPerson of oldPeople) {
        if (oldPerson.id.startsWith("temp-") && !newIds.has(oldPerson.id)) {
          const match = oldPerson.id.match(/^temp-(\d+)$/);
          if (match) {
            const deviceId = Number(match[1]);
            disableAutoOpenByDevice(deviceId);
          }
        }
      }

      res.json({ status: "SUCCESS", people });
    } else {
      res.status(400).json({ error: "people must be an array" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/people/toggle", (req, res) => {
  try {
    const { id, enabled } = req.body;
    const people = getPeople();
    const person = people.find((p: any) => p.id === id);
    if (person) {
      person.enabled = enabled;
      savePeople(people);

      // If disabling a temporary/courier person, disable their active SIP task as well!
      if (!enabled && id.startsWith("temp-")) {
        const match = id.match(/^temp-(\d+)$/);
        if (match) {
          const deviceId = Number(match[1]);
          disableAutoOpenByDevice(deviceId);
        }
      }

      res.json({ status: "SUCCESS", person });
    } else {
      res.status(404).json({ error: "Person not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
