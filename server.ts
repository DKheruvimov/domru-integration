import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { DomruClient, getAccountsByPhone, requestSmsCode, confirmSmsCode } from "./src/domru-js/index.js";

// Bypass Russian Trusted CA / invalid / expired self-signed certificates for video streaming subdomains
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Healthy check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Code inspection helper endpoints
  app.get("/api/code/list", (req, res) => {
    const defaultFiles = [
      { path: "src/domru-js/client.ts", name: "client.ts", category: "core" },
      { path: "src/domru-js/index.ts", name: "index.ts", category: "core" },
      { path: "src/domru-js/constants.ts", name: "constants.ts", category: "core" },
      { path: "src/domru-js/context.ts", name: "context.ts", category: "core" },
      { path: "src/domru-js/errors.ts", name: "errors.ts", category: "core" },
      { path: "src/domru-js/types.ts", name: "types.ts", category: "core" },
      { path: "src/domru-js/api/intercom.ts", name: "api/intercom.ts", category: "api" },
      { path: "src/domru-js/api/places.ts", name: "api/places.ts", category: "api" },
      { path: "src/domru-js/api/cameras.ts", name: "api/cameras.ts", category: "api" },
      { path: "src/domru-js/api/stream.ts", name: "api/stream.ts", category: "api" },
      { path: "src/domru-js/api/events.ts", name: "api/events.ts", category: "api" },
      { path: "src/domru-js/api/finances.ts", name: "api/finances.ts", category: "api" },
      { path: "src/domru-js/http/client.ts", name: "http/client.ts", category: "http" },
      { path: "src/domru-js/http/cache.ts", name: "http/cache.ts", category: "http" },
      { path: "examples/device.ts", name: "examples/device.ts", category: "interfaces" },
    ];
    res.json(defaultFiles);
  });

  app.get("/api/code/read", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath || (!filePath.startsWith("src/domru-js/") && !filePath.startsWith("examples/") && !filePath.startsWith("tests/"))) {
      return res.status(403).json({ error: "Access denied" });
    }
    const absolutePath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    try {
      const content = fs.readFileSync(absolutePath, "utf-8");
      res.json({ content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Client Helper with Error Handling
  const handleClientError = (err: any, res: any) => {
    console.error("Domru API Error:", err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: err.message || "Internal Server Error",
      statusCode,
      apiCode: err.apiCode || null,
      name: err.name || "Error",
    });
  };

  // Setup stateless Client based on headers or query parameters (important for standard HTML5 img tags)
  const getDomruInstance = (req: express.Request) => {
    const sanitizeString = (val: any): string | undefined => {
      if (!val) return undefined;
      const str = String(val).trim();
      if (str === "" || str === "undefined" || str === "null") return undefined;
      return str;
    };

    const sanitizeNumber = (val: any): number | undefined => {
      if (!val) return undefined;
      const str = String(val).trim();
      if (str === "" || str === "undefined" || str === "null") return undefined;
      const num = Number(str);
      return isNaN(num) ? undefined : num;
    };

    const login = sanitizeString(req.headers["x-domru-login"] || req.query.login);
    const password = sanitizeString(req.headers["x-domru-password"] || req.query.password);
    const token = sanitizeString(req.headers["x-domru-token"] || req.query.token);
    const refreshToken = sanitizeString(req.headers["x-domru-refresh-token"] || req.query.refreshToken);
    const operatorId = sanitizeNumber(req.headers["x-domru-operator-id"] || req.query.operatorId);

    const client = new DomruClient({
      login,
      password,
      refreshToken,
      operatorId,
      timeout: 10000,
    });

    // Manually push access token if already provided to save login cycles
    if (token) {
      // Accessing ctx under the hood or we let it refresh automatically
      const ctx = (client as any).ctx;
      if (ctx) {
        ctx.accessToken = token;
        // Assume non-expired initially, if it fails, client.ts handles 401 refresh on its own
        ctx.accessTokenExpiresAt = Date.now() + 60 * 60 * 1000; 
      }
    }

    return client;
  };

  // Mock / Simulation Data for DEMO mode
  const isDemo = (req: express.Request) => {
    return req.headers["x-domru-demo"] === "true" || req.query.demo === "true";
  };

  const MOCK_PLACES = [
    {
      id: 1001,
      subscriberType: "RESIDENTIAL",
      subscriberState: "ACTIVE",
      place: {
        id: 1001,
        address: {
          visibleAddress: "ул. Ленина, д. 10, кв. 42",
          city: "Новосибирск",
          street: "Ленина",
          house: "10",
          flat: "42",
        },
      },
      subscriber: {
        id: 55001,
        name: "Иван Сергеевич Иванов",
        accountId: "278104829",
      },
      guardCallOut: {
        allowed: true,
        price: 0,
      },
      payment: {
        balance: 350.0,
        paymentPeriod: "до 25.06.2026",
      },
      provider: "ER-Telecom",
      blocked: false,
    },
    {
      id: 1002,
      subscriberType: "RESIDENTIAL",
      subscriberState: "ACTIVE",
      place: {
        id: 1002,
        address: {
          visibleAddress: "пр. Карла Маркса, д. 22, кв. 115",
          city: "Новосибирск",
          street: "Карла Маркса",
          house: "22",
          flat: "115",
        },
      },
      subscriber: {
        id: 55001,
        name: "Иван Сергеевич Иванов",
        accountId: "278104829",
      },
      guardCallOut: {
        allowed: false,
        price: 50,
      },
      payment: {
        balance: -12.5,
        paymentPeriod: "до 25.06.2026",
      },
      provider: "ER-Telecom",
      blocked: false,
    },
  ];

  const MOCK_DEVICES = {
    1001: [
      {
        id: 2001,
        operatorId: 123,
        name: "Основной домофон (Подъезд)",
        forpostGroupId: "forpost-group-1",
        forpostAccountId: "forpost-acc-1",
        type: "intercom",
        allowOpen: true,
        openMethod: "IP",
        allowVideo: true,
        allowCallMobile: true,
        allowSlideshow: true,
        previewAvailable: true,
        videoDownloadAvailable: true,
        timeZone: 7,
        quota: 100,
        externalCameraId: "cam-001",
        externalDeviceId: "dev-001",
      },
      {
        id: 2002,
        operatorId: 123,
        name: "Калитка во двор",
        forpostGroupId: "forpost-group-1",
        forpostAccountId: "forpost-acc-1",
        type: "gate",
        allowOpen: true,
        openMethod: "IP",
        allowVideo: true,
        allowCallMobile: false,
        allowSlideshow: false,
        previewAvailable: true,
        videoDownloadAvailable: false,
        timeZone: 7,
        quota: 0,
        externalCameraId: "cam-002",
        externalDeviceId: "dev-002",
      },
    ],
    1002: [
      {
        id: 2003,
        operatorId: 123,
        name: "Шлагбаум на парковку",
        forpostGroupId: "forpost-group-2",
        forpostAccountId: "forpost-acc-2",
        type: "barrier",
        allowOpen: true,
        openMethod: "IP",
        allowVideo: false,
        allowCallMobile: false,
        allowSlideshow: false,
        previewAvailable: false,
        videoDownloadAvailable: false,
        timeZone: 7,
        quota: 0,
        externalCameraId: "",
        externalDeviceId: "dev-003",
      },
    ],
  };

  const MOCK_CAMERAS = [
    {
      id: "cam-001",
      name: "Основной домофон (Подъезд) Камера",
      placeId: 1001,
      isExternal: true,
      allowVideo: true,
    },
    {
      id: "cam-002",
      name: "Калитка Камера",
      placeId: 1001,
      isExternal: true,
      allowVideo: true,
    },
  ];

  const MOCK_EVENTS = [
    {
      id: 991,
      placeId: 1001,
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      eventType: "DOOR_OPENED",
      title: "Дверь открыта",
      description: "Жилец открыл дверь из приложения",
      deviceName: "Основной домофон (Подъезд)",
      imageUrl: "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: 992,
      placeId: 1001,
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      eventType: "VISITOR_CALL",
      title: "Входящий вызов",
      description: "Звонок в кв. 42",
      deviceName: "Основной домофон (Подъезд)",
      imageUrl: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: 993,
      placeId: 1001,
      timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      eventType: "GATE_OPENED",
      title: "Калитка открыта",
      description: "Проезд транспорта по коду",
      deviceName: "Калитка во двор",
      imageUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80",
    },
  ];

  // API Route: Authenticate
  app.post("/api/domru/login", async (req, res) => {
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

  const normalizePhone = (phone: string): string => {
    let clean = String(phone || "").replace(/\D/g, "");
    if (clean.length === 10) {
      return "7" + clean;
    }
    if (clean.length === 11) {
      if (clean.startsWith("8")) {
        return "7" + clean.substring(1);
      }
      return clean;
    }
    return clean;
  };

  // API Route: SMS Accounts Fetch
  app.post("/api/domru/sms/accounts", async (req, res) => {
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
  app.post("/api/domru/sms/request", async (req, res) => {
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
  app.post("/api/domru/sms/confirm", async (req, res) => {
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
  app.get("/api/domru/places", async (req, res) => {
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
  app.get("/api/domru/devices/:placeId", async (req, res) => {
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
  app.get("/api/domru/cameras", async (req, res) => {
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

  // API Route: Video Stream URL with CORS/MixedContent secure proxy wrapping
  app.get("/api/domru/stream/:cameraId", async (req, res) => {
    const { cameraId } = req.params;
    if (isDemo(req)) {
      // Return beautiful demo stream video file or public HLS stream URL (bunny stream is great)
      return res.json({
        url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        type: "HLS", // Mark as HLS or compatible so the frontend handles it
      });
    }

    try {
      const client = getDomruInstance(req);
      const stream = await client.getStreamUrl(cameraId);
      if (stream && stream.url && !stream.url.toLowerCase().startsWith("rtsp://")) {
        const originalUrl = stream.url;
        // Wrap with our secure gateway proxy to bypass browser sandboxing restrictions (CORS & HTTPS Mixed Content)
        const login = req.headers["x-domru-login"] || "";
        const password = req.headers["x-domru-password"] || "";
        const token = req.headers["x-domru-token"] || "";
        const operatorId = req.headers["x-domru-operator-id"] || "";
        const refreshToken = req.headers["x-domru-refresh-token"] || "";

        let proxiedUrl = `/api/domru/stream-proxy?url=${encodeURIComponent(originalUrl)}`;
        if (login) proxiedUrl += `&login=${encodeURIComponent(login as string)}`;
        if (password) proxiedUrl += `&password=${encodeURIComponent(password as string)}`;
        if (token) proxiedUrl += `&token=${encodeURIComponent(token as string)}`;
        if (operatorId) proxiedUrl += `&operatorId=${encodeURIComponent(operatorId as string)}`;
        if (refreshToken) proxiedUrl += `&refreshToken=${encodeURIComponent(refreshToken as string)}`;

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
  app.options("/api/domru/stream-proxy", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "*");
    res.sendStatus(200);
  });

  // API Route: CORS/MixedContent secure proxy for domestic HLS/M3U8 streams
  app.get("/api/domru/stream-proxy", async (req, res) => {
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

    // Set explicit CORS headers so the client can request HLS playlist and chunks from this endpoint without restrictions
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Expose-Headers", "*");

    try {
      // Forward safe request headers from client to remote server (crucial for Range requests in Safari/iOS)
      const requestHeaders: Record<string, string> = {
        "User-Agent": (req.headers["user-agent"] as string) || "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        "Accept": (req.headers["accept"] as string) || "*/*"
      };

      if (req.headers["range"]) {
        requestHeaders["Range"] = req.headers["range"] as string;
      }
      if (req.headers["if-range"]) {
        requestHeaders["If-Range"] = req.headers["if-range"] as string;
      }

      // Add Authorization and Operator headers if request target is a Domru / Proptech site (important for decryption keys!)
      const isDomruDomain = targetUrl.includes("proptech.ru") || targetUrl.includes("domru.ru") || targetUrl.includes("ertelecom.ru");
      if (isDomruDomain) {
        if (token) {
          requestHeaders["Authorization"] = `Bearer ${token}`;
        }
        if (operatorId) {
          requestHeaders["Operator"] = String(operatorId);
        }
      }

      console.log(`[STREAM_PROXY] Fetching target: ${targetUrl} (isDomruDomain=${isDomruDomain}, Range=${req.headers["range"] || 'none'})`);
      const response = await fetch(targetUrl, {
        headers: requestHeaders
      });

      console.log(`[STREAM_PROXY] Remote Response Status: ${response.status} ${response.statusText}`);
      // 200 OK or 206 Partial Content are both valid success codes
      if (!response.ok && response.status !== 206) {
        console.error(`[STREAM_PROXY] Error response from remote server: ${response.status}`);
        return res.status(response.status).send(`Stream request failed: ${response.statusText}`);
      }

      // Forward correct HTTP Status Code
      res.status(response.status);

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

      for (const h of headersToForward) {
        const val = response.headers.get(h);
        if (val !== null) {
          res.setHeader(h, val);
        }
      }

      const contentType = response.headers.get("content-type") || "";
      console.log(`[STREAM_PROXY] Remote Content-Type: ${contentType}`);

      const isM3u8 = targetUrl.includes(".m3u8") || 
                     contentType.includes("mpegurl") || 
                     contentType.includes("x-mpegurl") ||
                     contentType.includes("application/vnd.apple.mpegurl") ||
                     contentType.includes("application/x-mpegURL");

      if (isM3u8) {
        // Force correct M3U8 content-type just in case
        res.setHeader("Content-Type", contentType || "application/vnd.apple.mpegurl");
        
        const text = await response.text();
        console.log(`[STREAM_PROXY] Content looks like M3U8. First 150 chars:\n${text.substring(0, 150)}`);
        const lines = text.split(/\r?\n/);
        const hostHeader = req.headers.host || "localhost:3000";
        const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";

        // Assemble auth headers as query options to propagate credentials to subsegments / subresources
        let authParams = "";
        if (login) authParams += `&login=${encodeURIComponent(login)}`;
        if (password) authParams += `&password=${encodeURIComponent(password)}`;
        if (token) authParams += `&token=${encodeURIComponent(token)}`;
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
              return `${protocol}://${hostHeader}/api/domru/stream-proxy?url=${encodeURIComponent(resolved)}${authParams}`;
            } catch {
              return trimmed;
            }
          }

          // Case 2: Tag lines specifying a subresource URI (e.g. encryption keys, e.g. URI="...")
          if (trimmed.includes("URI=")) {
            trimmed = trimmed.replace(/URI="([^"]+)"/g, (match, p1) => {
              try {
                const resolved = new URL(p1, targetUrl).toString();
                const proxied = `${protocol}://${hostHeader}/api/domru/stream-proxy?url=${encodeURIComponent(resolved)}${authParams}`;
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
        // High-speed low-latency stream-through chunk bypass
        if (response.body) {
          if (typeof (response.body as any).pipe === 'function') {
            (response.body as any).pipe(res);
          } else {
            // Web Standard ReadableStream
            const reader = response.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              res.write(value);
            }
            res.end();
          }
        } else {
          const arrayBuffer = await response.arrayBuffer();
          res.send(Buffer.from(arrayBuffer));
        }
      }
    } catch (err: any) {
      console.error("[STREAM_PROXY] Error fetching target stream url:", targetUrl, err);
      res.status(500).send(`CORS Gateway stream failure: ${err.message || err}. Target: ${targetUrl}. Stack: ${err.stack || "No stack"}`);
    }
  });

  // API Route: Open Intercom Door/Gate
  app.get("/api/domru/snapshot/:placeId/:deviceId", async (req, res) => {
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
  app.post("/api/domru/open", async (req, res) => {
    const { placeId, deviceId } = req.body;
    if (isDemo(req)) {
      return res.json({
        status: "SUCCESS",
        message: "Дверь успешно открыта",
      });
    }

    try {
      const client = getDomruInstance(req);
      const result = await client.openDoor(Number(placeId), Number(deviceId));
      res.json(result);
    } catch (err: any) {
      handleClientError(err, res);
    }
  });

  // API Route: Historical Events
  app.post("/api/domru/events", async (req, res) => {
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
  app.post("/api/domru/temporal", async (req, res) => {
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
  app.get("/api/domru/finances", async (req, res) => {
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

  // Helper for Yandex Smart Home Request ID extraction
  const getRequestId = (req: express.Request): string => {
    return (req.headers["x-request-id"] || req.headers["X-Request-Id"] || "") as string;
  };

  // Helper to extract DomruClient from the Yandex Authorization header or query token
  const getDomruInstanceFromToken = (req: express.Request) => {
    const authHeader = req.headers["authorization"] || "";
    let token = "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else {
      token = String(req.query.token || "").trim();
    }

    if (!token) {
      throw new Error("No token provided");
    }

    // Is it a static demo token or uses 'demo'
    if (token === "demo-access-token-123" || token.includes("demo")) {
      return {
        client: new DomruClient({ login: "demo", password: "demo", refreshToken: "demo" }),
        isDemo: true,
        userId: "demo_user"
      };
    }

    try {
      let cleanToken = token;
      if (token.startsWith("at_")) {
        cleanToken = token.substring(3);
      } else if (token.startsWith("rt_")) {
        cleanToken = token.substring(3);
      }

      const decodedStr = Buffer.from(cleanToken, "base64").toString("utf-8");
      const creds = JSON.parse(decodedStr);

      if (creds.isDemo) {
        return {
          client: new DomruClient({ login: "demo", password: "demo", refreshToken: "demo" }),
          isDemo: true,
          userId: "demo_user"
        };
      }

      const client = new DomruClient({
        login: creds.login,
        password: creds.password,
        refreshToken: creds.refreshToken,
        operatorId: creds.operatorId,
        timeout: 10000,
      });

      if (creds.token) {
        const ctx = (client as any).ctx;
        if (ctx) {
          ctx.accessToken = creds.token;
          ctx.accessTokenExpiresAt = Date.now() + 60 * 60 * 1000;
        }
      }

      return {
        client,
        isDemo: false,
        userId: creds.login || "user"
      };
    } catch (err) {
      console.error("Yandex smart home Bearer token decode error:", err);
      throw new Error("Invalid or expired token");
    }
  };

  // Helper to construct fully qualified stream URLs in production environment
  const getBaseUrl = (req: express.Request) => {
    const host = req.headers.host || "localhost:3000";
    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    return `${protocol}://${host}`;
  };

  // Yandex OAuth2 Endpoint: Authorization Consent Page (serves premium UX in Russian with direct Demo mode option)
  app.get("/oauth/authorize", (req, res) => {
    const clientId = req.query.client_id;
    const redirectUri = req.query.redirect_uri;
    const state = req.query.state;
    const responseType = req.query.response_type;

    if (!redirectUri) {
      return res.status(400).send("Bad request: missing redirect_uri");
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yandex Умный Дом — Авторизация Dom.ru/Forpost</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: "Inter", sans-serif; background-color: #0c0a09; color: #f5f5f4; }
    .animate-fade-in {
      animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#121214] via-[#0d0d0f] to-[#121214]">
  <div class="w-full max-w-md bg-zinc-900 border border-zinc-800/80 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
    <!-- Red ambient backdrop -->
    <div class="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

    <!-- Header info -->
    <div class="text-center mb-8 relative">
      <div class="w-16 h-16 bg-gradient-to-tr from-red-600 to-[#E30613] rounded-2xl flex items-center justify-center mx-auto mb-4 hover:scale-105 transition-transform shadow-lg shadow-red-600/20">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8 text-white">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.02 5.912L12 16.5H9v3H6v-3l1.588-1.588A6.002 6.002 0 0115.75 5.25z" />
        </svg>
      </div>
      <h1 class="text-xl font-bold tracking-tight text-white mb-2">Связка с Алисой</h1>
      <p class="text-xs text-zinc-400 max-w-xs mx-auto">Подключите ваши умные домофоны и уличные камеры Forpost к Умному Дому Яндекса за несколько простых шагов.</p>
    </div>

    <!-- Custom Danger/Success Banner -->
    <div id="error-alert" class="hidden p-4 rounded-2xl bg-red-950/40 border border-red-800/50 text-red-400 text-xs mb-6 flex gap-2 items-start">
      <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span id="error-message">Произошла неизвестная ошибка. Пожалуйста, попробуйте снова.</span>
    </div>

    <!-- Tabs for selecting authentication method -->
    <div class="flex bg-black/40 p-1.5 rounded-2xl gap-1 mb-6 border border-zinc-800/40" id="auth-tabs">
      <button onclick="setAuthMethod('sms')" id="tab-sms" class="flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-200 text-white bg-[#E30613] shadow shadow-red-600/10 cursor-pointer">
        По СМС
      </button>
      <button onclick="setAuthMethod('password')" id="tab-password" class="flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-200 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800/30">
        Договор и Пароль
      </button>
    </div>

    <!-- 1. Screen Enter Phone -->
    <div id="step1" class="space-y-5 animate-fade-in">
      <div>
        <label class="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Ваш номер телефона</label>
        <div class="relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-550 font-semibold text-sm">+7</span>
          <input type="tel" id="sms-phone" placeholder="999 123-4567" class="w-full bg-black/40 border border-zinc-800/80 rounded-2xl py-4.5 pl-12 pr-4 text-sm font-medium text-white focus:outline-none focus:border-red-650 transition-colors placeholder-zinc-700">
        </div>
      </div>
      
      <button onclick="handleGetAccounts()" id="btn-get-accounts" class="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white text-xs font-semibold py-4.5 rounded-2xl transition justify-center items-center flex gap-2 shadow-lg shadow-red-600/10 cursor-pointer">
        <span>Проверить аккаунты</span>
        <svg id="spinner-get-accounts" class="w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>

      <div class="relative py-2 flex items-center justify-center">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-zinc-800/60"></div></div>
        <span class="relative bg-zinc-900 px-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Тестовый вход</span>
      </div>

      <button onclick="loginWithDemo()" class="w-full bg-zinc-950 hover:bg-zinc-850 text-zinc-350 active:scale-[0.98] text-xs font-semibold py-4 rounded-2xl transition flex items-center justify-center gap-2 border border-zinc-800/60 border-dashed cursor-pointer">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Войти в режиме Демо (Для Модератора)</span>
      </button>
    </div>

    <!-- 4. Screen Password Login -->
    <div id="step-password" class="space-y-5 hidden animate-fade-in">
      <div class="space-y-4">
        <div>
          <label class="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Логин (№ договора или телефон)</label>
          <input type="text" id="pass-login" placeholder="Например, 520900240557" class="w-full bg-black/40 border border-zinc-800/80 rounded-2xl py-4.5 px-4 text-sm font-medium text-white focus:outline-none focus:border-red-650 transition-colors placeholder-zinc-700">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Пароль</label>
          <input type="password" id="pass-password" placeholder="Введите пароль" class="w-full bg-black/40 border border-zinc-800/80 rounded-2xl py-4.5 px-4 text-sm font-medium text-white focus:outline-none focus:border-red-650 transition-colors placeholder-zinc-700">
        </div>
      </div>

      <button onclick="handlePasswordLogin()" id="btn-password-login" class="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white text-xs font-semibold py-4.5 rounded-2xl transition justify-center items-center flex gap-2 cursor-pointer shadow-lg shadow-red-600/10">
        <span>Войти и связать аккаунт</span>
        <svg id="spinner-password-login" class="w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>

      <div class="relative py-2 flex items-center justify-center">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-zinc-800/60"></div></div>
        <span class="relative bg-zinc-900 px-3 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Тестовый вход</span>
      </div>

      <button onclick="loginWithDemo()" class="w-full bg-zinc-950 hover:bg-zinc-850 text-zinc-350 active:scale-[0.98] text-xs font-semibold py-4 rounded-2xl transition flex items-center justify-center gap-2 border border-zinc-800/60 border-dashed cursor-pointer">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Войти в режиме Демо (Для Модератора)</span>
      </button>
    </div>

    <!-- 2. Screen Account Choose -->
    <div id="step2" class="space-y-5 hidden animate-fade-in">
      <div>
        <label class="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Выберите договор / адрес</label>
        <div id="accounts-container" class="space-y-2 max-h-52 overflow-y-auto pr-1"></div>
      </div>

      <button onclick="handleSendSms()" id="btn-send-sms" class="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white text-xs font-semibold py-4.5 rounded-2xl transition justify-center items-center flex gap-2 cursor-pointer shadow-lg shadow-red-600/10">
        <span>Выслать СМС код подтверждения</span>
        <svg id="spinner-send-sms" class="w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>

      <button onclick="goBackToStep1()" class="w-full bg-transparent hover:bg-zinc-800 text-zinc-400 text-xs font-semibold py-3.5 rounded-2xl transition cursor-pointer border border-zinc-800">
        Изменить телефон
      </button>
    </div>

    <!-- 3. Screen Code SMS -->
    <div id="step3" class="space-y-5 hidden animate-fade-in">
      <div>
        <label class="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">СМС код отправлен на +7<span id="label-target-phone"></span></label>
        <input type="text" id="sms-code" placeholder="Код подтверждения" class="w-full bg-black/40 border border-zinc-800/80 rounded-2xl py-4.5 text-center text-lg tracking-[0.4rem] font-bold text-white focus:outline-none focus:border-red-600 transition-colors placeholder-zinc-700">
      </div>

      <button onclick="handleConfirmSms()" id="btn-confirm-sms" class="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white text-xs font-semibold py-4.5 rounded-2xl transition justify-center items-center flex gap-2 cursor-pointer shadow-lg shadow-red-600/10">
        <span>Привязать аккаунт к Яндексу</span>
        <svg id="spinner-confirm-sms" class="w-4 h-4 animate-spin hidden" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>

      <button onclick="goBackToStep2()" class="w-full bg-transparent hover:bg-zinc-800 text-zinc-400 text-xs font-semibold py-3.5 rounded-2xl transition cursor-pointer border border-zinc-800">
        Выбрать другой адрес
      </button>
    </div>
  </div>

  <script>
    let phoneVal = "";
    let accounts = [];
    let selectedAccountIndex = 0;
    let currentAuthMethod = "sms";

    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");
    const step3 = document.getElementById("step3");
    const stepPassword = document.getElementById("step-password");
    const authTabs = document.getElementById("auth-tabs");

    const phoneInput = document.getElementById("sms-phone");
    const smsCodeInput = document.getElementById("sms-code");

    const errorAlert = document.getElementById("error-alert");
    const errorMessage = document.getElementById("error-message");

    const urlParams = new URLSearchParams(window.location.search);
    const redirectUri = urlParams.get("redirect_uri");
    const stateVal = urlParams.get("state") || "";

    function showError(msg) {
      errorMessage.textContent = msg;
      errorAlert.classList.remove("hidden");
    }

    function clearError() {
      errorAlert.classList.add("hidden");
    }

    function toggleSpinner(id, isShow) {
      const spinner = document.getElementById(id);
      if (spinner) {
        if (isShow) spinner.classList.remove("hidden");
        else spinner.classList.add("hidden");
      }
    }

    function setAuthMethod(method) {
      clearError();
      currentAuthMethod = method;
      
      const tabSms = document.getElementById("tab-sms");
      const tabPassword = document.getElementById("tab-password");
      
      if (method === "sms") {
        tabSms.className = "flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-200 text-white bg-[#E30613] shadow shadow-red-600/10 cursor-pointer";
        tabPassword.className = "flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-200 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800/30";
        
        stepPassword.classList.add("hidden");
        step1.classList.remove("hidden");
        step2.classList.add("hidden");
        step3.classList.add("hidden");
      } else {
        tabPassword.className = "flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-200 text-white bg-[#E30613] shadow shadow-red-600/10 cursor-pointer";
        tabSms.className = "flex-1 py-2.5 text-xs font-bold rounded-xl transition duration-200 text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800/30";
        
        step1.classList.add("hidden");
        step2.classList.add("hidden");
        step3.classList.add("hidden");
        stepPassword.classList.remove("hidden");
      }
    }

    // Step 1: Query contracts lists
    async function handleGetAccounts() {
      clearError();
      const rawPhone = phoneInput.value.replace(/\D/g, "");
      if (!rawPhone || rawPhone.length < 10) {
        showError("Введите корректный номер телефона (например, +7 999 123-45-67).");
        return;
      }

      phoneVal = "7" + rawPhone.slice(-10);
      toggleSpinner("spinner-get-accounts", true);

      try {
        const res = await fetch("/api/domru/sms/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneVal })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Ошибка соединения с провайдером.");
        }

        accounts = await res.json();
        if (!accounts || accounts.length === 0) {
          throw new Error("Не найдено ни одного адреса на этот номер телефона.");
        }

        renderAccounts();
        
        if (authTabs) authTabs.classList.add("hidden");
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
      } catch (err) {
        showError(err.message);
      } finally {
        toggleSpinner("spinner-get-accounts", false);
      }
    }

    // Render Contracts
    function renderAccounts() {
      const container = document.getElementById("accounts-container");
      container.innerHTML = "";
      
      accounts.forEach((acc, idx) => {
        const checked = idx === 0 ? "checked" : "";
        const elem = document.createElement("label");
        elem.className = "flex items-start gap-3 p-4 bg-black/40 border border-zinc-800/80 rounded-2xl cursor-pointer hover:border-red-650 transition-all block relative select-none";
        elem.innerHTML = \`
          <input type="radio" name="selected_acc" value="\${idx}" \${checked} class="mt-1 accent-red-600 shrink-0">
          <div class="text-xs">
            <p class="font-bold text-white mb-0.5 leading-tight">\${acc.address}</p>
            <p class="text-[10px] text-zinc-550">Договор: \${acc.accountId} | Провайдер ID \${acc.operatorId}</p>
          </div>
        \`;
        container.appendChild(elem);
      });
    }

    // Step 2: Send SMS Code
    async function handleSendSms() {
      clearError();
      const selectedRadio = document.querySelector("input[name='selected_acc']:checked");
      if (!selectedRadio) {
        showError("Пожалуйста, укажите хотя бы один договор.");
        return;
      }

      selectedAccountIndex = parseInt(selectedRadio.value, 10);
      const acc = accounts[selectedAccountIndex];

      toggleSpinner("spinner-send-sms", true);

      try {
        const res = await fetch("/api/domru/sms/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneVal, account: acc })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Не удалось выслать SMS код.");
        }

        document.getElementById("label-target-phone").textContent = phoneVal.slice(-10);
        step2.classList.add("hidden");
        step3.classList.remove("hidden");
      } catch (err) {
        showError(err.message);
      } finally {
        toggleSpinner("spinner-send-sms", false);
      }
    }

    // Step 3: Verify SMS
    async function handleConfirmSms() {
      clearError();
      const code = smsCodeInput.value.replace(/\D/g, "");
      if (!code || code.length !== 4) {
        showError("Длина проверочного СМС кода должна быть ровно 4 символа.");
        return;
      }

      const acc = accounts[selectedAccountIndex];
      toggleSpinner("spinner-confirm-sms", true);

      try {
        const res = await fetch("/api/domru/sms/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneVal, code: code, account: acc })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Неверный код СМС.");
        }

        const data = await res.json();
        
        // Successfully got token! Complete authentication back to Yandex webhook callback
        const finalCreds = {
          login: phoneVal,
          token: data.token,
          refreshToken: data.refreshData.refreshToken,
          operatorId: data.refreshData.operatorId,
          isDemo: false
        };

        completeYandexOAuth(finalCreds);
      } catch (err) {
        showError(err.message);
      } finally {
        toggleSpinner("spinner-confirm-sms", false);
      }
    }

    // Password-based Login Submit
    async function handlePasswordLogin() {
      clearError();
      const loginInput = document.getElementById("pass-login");
      const passwordInput = document.getElementById("pass-password");
      
      const loginValRaw = loginInput.value.trim();
      const passwordValRaw = passwordInput.value;
      
      if (!loginValRaw || !passwordValRaw) {
        showError("Пожалуйста, введите логин и пароль.");
        return;
      }
      
      toggleSpinner("spinner-password-login", true);
      
      try {
        const res = await fetch("/api/domru/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-domru-login": loginValRaw,
            "x-domru-password": passwordValRaw
          }
        });
        
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Неверный логин или пароль.");
        }
        
        const data = await res.json();
        
        const finalCreds = {
          login: loginValRaw,
          password: passwordValRaw,
          token: data.token,
          refreshToken: data.refreshData.refreshToken,
          operatorId: data.refreshData.operatorId,
          isDemo: false
        };
        
        completeYandexOAuth(finalCreds);
      } catch (err) {
        showError(err.message);
      } finally {
        toggleSpinner("spinner-password-login", false);
      }
    }

    // Stateless Completion
    function completeYandexOAuth(creds) {
      if (!redirectUri) {
        showError("Пожалуйста, откройте авторизацию через кабинет Яндекс Диалогов. Не передан redirect_uri.");
        return;
      }

      const jsonStr = JSON.stringify(creds);
      const base64Code = btoa(unescape(encodeURIComponent(jsonStr)));
      
      const finalUrl = redirectUri + "?code=" + base64Code + "&state=" + encodeURIComponent(stateVal);
      window.location.href = finalUrl;
    }

    function loginWithDemo() {
      const demoCreds = {
        login: "demo_phone",
        token: "demo-access-token-123",
        refreshToken: "demo-refresh-token-456",
        operatorId: 123,
        isDemo: true
      };
      completeYandexOAuth(demoCreds);
    }

    // Nav Helpers
    function goBackToStep1() {
      if (authTabs) authTabs.classList.remove("hidden");
      step2.classList.add("hidden");
      step1.classList.remove("hidden");
    }

    function goBackToStep2() {
      step3.classList.add("hidden");
      step2.classList.remove("hidden");
    }
  </script>
</body>
</html>`;
    res.send(htmlContent);
  });

  // Yandex OAuth2 Endpoint: Token Exchange and Token Refresh
  app.post("/oauth/token", (req, res) => {
    // Note: Yandex sends application/x-www-form-urlencoded format
    const grantType = req.body.grant_type;
    const code = req.body.code;
    const refreshToken = req.body.refresh_token;

    if (grantType === "authorization_code") {
      if (!code) {
        return res.status(400).json({ error: "invalid_request", error_description: "Missing authorization code" });
      }

      // Code contains the base64-encoded credentials.
      // We issue access_token by prefixing with 'at_' and refresh_token with 'rt_'.
      res.json({
        access_token: "at_" + code,
        refresh_token: "rt_" + code,
        expires_in: 31536000 // 1 year expiration
      });
    } else if (grantType === "refresh_token") {
      if (!refreshToken) {
        return res.status(400).json({ error: "invalid_request", error_description: "Missing refresh_token" });
      }

      // Convert refresh_token cleanly back to a valid access_token
      const freshCode = refreshToken.startsWith("rt_") ? refreshToken.substring(3) : refreshToken;
      res.json({
        access_token: "at_" + freshCode,
        refresh_token: "rt_" + freshCode,
        expires_in: 31536000
      });
    } else {
      res.status(400).json({ error: "unsupported_grant_type" });
    }
  });

  // Yandex Provider Endpoint: Ping (Head or Get /v1.0)
  app.get("/v1.0", (req, res) => {
    res.setHeader("X-Request-Id", getRequestId(req));
    res.sendStatus(200);
  });
  app.head("/v1.0", (req, res) => {
    res.setHeader("X-Request-Id", getRequestId(req));
    res.sendStatus(200);
  });

  // Yandex Provider Endpoint: Unlink Account webhook
  app.post("/v1.0/user/unlink", (req, res) => {
    res.setHeader("X-Request-Id", getRequestId(req));
    res.json({
      request_id: getRequestId(req)
    });
  });

  // Yandex Provider Endpoint: Devices Discovery webhook
  app.get("/v1.0/user/devices", async (req, res) => {
    const requestId = getRequestId(req);
    res.setHeader("X-Request-Id", requestId);

    try {
      const { client, isDemo, userId } = getDomruInstanceFromToken(req);

      let places: any[] = [];
      let devicesByPlace: { [key: number]: any[] } = {};
      let cameras: any[] = [];

      if (isDemo) {
        places = MOCK_PLACES;
        devicesByPlace = MOCK_DEVICES;
        cameras = MOCK_CAMERAS;
      } else {
        try {
          places = await client.getSubscriberPlaces();
          // Concurrently fetch all devices across all available places
          await Promise.all(
            places.map(async (place) => {
              try {
                const devs = await client.getDevices(place.id);
                devicesByPlace[place.id] = devs;
              } catch (err) {
                console.error(`Yandex recovery: failed to fetch devices for place ${place.id}:`, err);
                devicesByPlace[place.id] = [];
              }
            })
          );
          try {
            cameras = await client.getCameras();
          } catch (err) {
            console.error("Yandex recovery: failed to fetch cameras list:", err);
            cameras = [];
          }
        } catch (err: any) {
          console.error("Yandex dynamic discovery fetch error:", err);
          const isAuthError = err.name === "AuthRequiredError" || 
                              err.name === "UnauthorizedError" || 
                              err.message?.includes("Auth") || 
                              err.message?.includes("Unauthorized") || 
                              err.statusCode === 401 || 
                              err.statusCode === 403;
          
          if (isAuthError) {
            return res.status(401).json({
              request_id: requestId,
              error: "invalid_token"
            });
          }
          return res.status(500).json({
            request_id: requestId,
            error: "Failed to communicate with Domru API"
          });
        }
      }

      const yandexDevices: any[] = [];

      // Map Intercom / Door / Gate physical openers
      for (const place of places) {
        const devs = devicesByPlace[place.id] || [];
        const address = place.place?.address?.visibleAddress || `Договор ${place.id}`;

        for (const dev of devs) {
          const deviceId = `device_${place.id}_${dev.id}`;
          let yandexType = "devices.types.smart_lock";

          if (dev.type === "gate" || dev.type === "barrier") {
            yandexType = "devices.types.openable";
          }

          yandexDevices.push({
            id: deviceId,
            name: dev.name || "Домофон",
            description: `Адрес: ${address}`,
            type: yandexType,
            room: address,
            capabilities: [
              {
                type: "devices.capabilities.on_off",
                retrievable: true,
                parameters: {
                  split: false
                }
              }
            ],
            device_info: {
              manufacturer: "Forpost / Dom.ru",
              model: dev.type || "intercom",
              hw_version: "1.0",
              sw_version: "1.0"
            }
          });
        }
      }

      // Map CCTV Security Cameras
      for (const cam of cameras) {
        const camId = `camera_${cam.id}`;
        const matchingPlace = places.find(p => p.id === cam.placeId);
        const address = matchingPlace?.place?.address?.visibleAddress || "Видеонаблюдение";

        yandexDevices.push({
          id: camId,
          name: cam.name || "Камера",
          description: "IP-камера безопасности Forpost",
          type: "devices.types.camera",
          room: address,
          capabilities: [
            {
              type: "devices.capabilities.video_stream",
              retrievable: true,
              parameters: {
                protocols: ["hls"]
              }
            }
          ],
          device_info: {
            manufacturer: "Forpost / Dom.ru",
            model: "CCTV Camera",
            hw_version: "1.0",
            sw_version: "1.0"
          }
        });
      }

      res.json({
        request_id: requestId,
        payload: {
          user_id: userId,
          devices: yandexDevices
        }
      });

    } catch (err: any) {
      console.error("Yandex discovery failure:", err);
      res.status(401).json({ request_id: requestId, error: "invalid_token" });
    }
  });

  // Yandex Provider Endpoint: Query state webhook
  app.post("/v1.0/user/devices/query", async (req, res) => {
    const requestId = getRequestId(req);
    res.setHeader("X-Request-Id", requestId);

    try {
      const { client, isDemo } = getDomruInstanceFromToken(req);
      const devices = req.body.devices;

      if (!devices || !Array.isArray(devices)) {
        return res.status(400).json({ request_id: requestId, error: "invalid_request" });
      }

      const resDevices: any[] = [];

      for (const reqDev of devices) {
        const devId = reqDev.id;

        if (devId.startsWith("camera_")) {
          const cameraId = devId.replace("camera_", "");
          let streamUrl = "";

          if (isDemo) {
            // High-quality mock HLS stream segment
            streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
          } else {
            try {
              const streamInfo = await client.getStreamUrl(cameraId);
              if (streamInfo && streamInfo.url) {
                // Return dynamic CORS-proxied dynamic URL
                streamUrl = `${getBaseUrl(req)}/api/domru/stream-proxy?url=${encodeURIComponent(streamInfo.url)}`;
              } else {
                streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
              }
            } catch (err) {
              console.error(`Yandex query: failed to resolve stream for camera ${cameraId}:`, err);
              streamUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
            }
          }

          resDevices.push({
            id: devId,
            capabilities: [
              {
                type: "devices.capabilities.video_stream",
                state: {
                  instance: "stream",
                  value: {
                    stream_url: streamUrl,
                    protocol: "hls"
                  }
                }
              }
            ]
          });
        } else if (devId.startsWith("device_")) {
          // Openers are pulse actuators. Responding default closed (value: false) is appropriate.
          resDevices.push({
            id: devId,
            capabilities: [
              {
                type: "devices.capabilities.on_off",
                state: {
                  instance: "on",
                  value: false
                }
              }
            ]
          });
        }
      }

      res.json({
        request_id: requestId,
        payload: {
          devices: resDevices
        }
      });

    } catch (err: any) {
      console.error("Yandex state query error:", err);
      res.status(401).json({ request_id: requestId, error: "invalid_token" });
    }
  });

  // Yandex Provider Endpoint: Execute command webhook
  app.post("/v1.0/user/devices/action", async (req, res) => {
    const requestId = getRequestId(req);
    res.setHeader("X-Request-Id", requestId);

    try {
      const { client, isDemo } = getDomruInstanceFromToken(req);
      const devices = req.body.payload?.devices;

      if (!devices || !Array.isArray(devices)) {
        return res.status(400).json({ request_id: requestId, error: "invalid_request" });
      }

      const resDevices: any[] = [];

      for (const reqDev of devices) {
        const devId = reqDev.id;
        const capabilities = reqDev.capabilities || [];
        const resCaps: any[] = [];

        for (const cap of capabilities) {
          if (cap.type === "devices.capabilities.on_off") {
            const valve = cap.state?.value;
            let status = "DONE";
            let errCode = null;

            if (valve === true) {
              // Trigger physical open action on real or mock device
              if (devId.startsWith("device_")) {
                const parts = devId.split("_");
                const placeId = Number(parts[1]);
                const deviceId = Number(parts[2]);

                if (!isDemo) {
                  try {
                    await client.openDoor(placeId, deviceId);
                    console.log(`[Yandex Alice] Open door succeeded for place ${placeId}, device ${deviceId}`);
                  } catch (errByDomru) {
                    console.error(`[Yandex Alice] Open door failed for place ${placeId}, device ${deviceId}:`, errByDomru);
                    status = "ERROR";
                    errCode = "DEVICE_UNREACHABLE";
                  }
                } else {
                  console.log(`[Yandex Alice Demo] Mock open command triggered for ${devId}`);
                }
              }
            }

            const capRes: any = {
              type: "devices.capabilities.on_off",
              state: {
                instance: "on",
                action_result: {
                  status: status
                }
              }
            };

            if (errCode) {
              capRes.state.action_result.error_code = errCode;
            }

            resCaps.push(capRes);
          }
        }

        resDevices.push({
          id: devId,
          capabilities: resCaps
        });
      }

      res.json({
        request_id: requestId,
        payload: {
          devices: resDevices
        }
      });

    } catch (err: any) {
      console.error("Yandex action failure:", err);
      res.status(401).json({ request_id: requestId, error: "invalid_token" });
    }
  });

  // Serve static assets / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
  });
}

startServer();
