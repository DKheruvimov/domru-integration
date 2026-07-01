import express from "express";
import { DomruClient } from "../src/domru-js/index.js";
import { getCredentials } from "./tokenStore.js";

// Client Helper with Error Handling
export const handleClientError = (err: any, res: express.Response) => {
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
export const getDomruInstance = (req: express.Request) => {
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
    logger: {
      info: (msg: string, ...args: any[]) => console.log(`[DomruClient:INFO] ${msg}`, ...args),
      warn: (msg: string, ...args: any[]) => console.warn(`[DomruClient:WARN] ${msg}`, ...args),
      error: (msg: string, ...args: any[]) => console.error(`[DomruClient:ERROR] ${msg}`, ...args),
      debug: (msg: string, ...args: any[]) => console.log(`[DomruClient:DEBUG] ${msg}`, ...args),
    }
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

// Middleware to prevent Authentication Bypass for local settings (Schedules, Auto-open)
export const requireDomruAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (isDemo(req)) {
    return next();
  }
  try {
    const client = getDomruInstance(req);
    const ctx = (client as any).ctx;
    if (!client.token && (!ctx.login || !ctx.password)) {
      return res.status(401).json({ error: "Unauthorized: Missing Domru credentials" });
    }
    // Eagerly verify credentials by hitting a lightweight Domru API endpoint
    // If credentials are bad, this will throw a 401 error which is caught below
    await client.getFinances();
    next();
  } catch (err: any) {
    console.error("[Auth Middleware] Invalid credentials:", err.message);
    res.status(401).json({ error: "Unauthorized: Invalid Domru credentials" });
  }
};

// Mock / Simulation Data for DEMO mode
export const isDemo = (req: express.Request) => {
  return req.headers["x-domru-demo"] === "true" || req.query.demo === "true";
};

export const MOCK_PLACES = [
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

export const MOCK_DEVICES = {
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

export const MOCK_CAMERAS = [
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

export const MOCK_EVENTS = [
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

export const normalizePhone = (phone: string): string => {
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

// Helper to extract DomruClient from the Yandex Authorization header or query token
export const getDomruInstanceFromToken = (req: express.Request) => {
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

    console.log(`[TOKEN_DEBUG] Raw token (first 8 + last 4): ${token.substring(0, 8)}...${token.length > 12 ? token.substring(token.length - 4) : "***"}`);
    console.log(`[TOKEN_DEBUG] Clean token length: ${cleanToken.length}`);

    let creds = getCredentials(cleanToken);
    console.log(`[TOKEN_DEBUG] getCredentials result: ${creds ? "FOUND" : "NOT_FOUND"}`);

    if (!creds) {
      try {
        const decodedStr = Buffer.from(cleanToken, "base64").toString("utf-8");
        creds = JSON.parse(decodedStr);
      } catch (decodeErr) {
        console.error("[TOKEN_DECODE] Failed to decode token as UUID or Base64:", decodeErr);
        throw new Error("Invalid or expired token");
      }
    }

    if (creds!.isDemo) {
      return {
        client: new DomruClient({ login: "demo", password: "demo", refreshToken: "demo" }),
        isDemo: true,
        userId: "demo_user"
      };
    }

    const client = new DomruClient({
      login: creds!.login,
      password: creds!.password,
      refreshToken: creds!.refreshToken,
      operatorId: creds!.operatorId,
      timeout: 10000,
      logger: {
        info: (msg: string, ...args: any[]) => console.log(`[DomruClient:INFO] ${msg}`, ...args),
        warn: (msg: string, ...args: any[]) => console.warn(`[DomruClient:WARN] ${msg}`, ...args),
        error: (msg: string, ...args: any[]) => console.error(`[DomruClient:ERROR] ${msg}`, ...args),
        debug: (msg: string, ...args: any[]) => console.log(`[DomruClient:DEBUG] ${msg}`, ...args),
      }
    });

    if (creds!.token) {
      const ctx = (client as any).ctx;
      if (ctx) {
        ctx.accessToken = creds!.token;
        ctx.accessTokenExpiresAt = Date.now() + 60 * 60 * 1000;
      }
    }

    return {
      client,
      isDemo: false,
      userId: creds!.login || "user"
    };
  } catch (err) {
    console.error("Yandex smart home Bearer token decode error:", err);
    throw new Error("Invalid or expired token");
  }
};
