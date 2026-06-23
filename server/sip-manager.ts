import { createRequire } from "module";
const require = createRequire("file://" + process.cwd() + "/");
const sip = require("sip");

import * as crypto from "crypto";

export interface SipCredentials {
  login: string;
  password: string;
  realm: string;
}

export interface AutoOpenTask {
  placeId: number;
  deviceId: number;
  credentials: SipCredentials;
  onOpenDoor: () => Promise<void>;
  expiresAt: number;
  callId?: string;
  fromTag?: string;
  maxOpens?: number | null;
  opensRemaining?: number | null;
}

export interface SipLog {
  timestamp: number;
  message: string;
  type: "info" | "error";
}

const activeTasks = new Map<string, AutoOpenTask>(); // login -> Task
let isSipStarted = false;
let cleanupInterval: NodeJS.Timeout | null = null;

const sipLogs: SipLog[] = [];

export function getSipLogs() {
  return sipLogs;
}

export function enableAutoOpen(task: AutoOpenTask) {
  task.opensRemaining = task.maxOpens;
  activeTasks.set(task.credentials.login, task);
  addSipLog(`[SIP] Enabled auto-open for ${task.credentials.login} (expires at ${new Date(task.expiresAt).toLocaleTimeString()}). Registering...`);
  startSipServer();
  sendRegister(task);
}

export function disableAutoOpen(login: string) {
  const task = activeTasks.get(login);
  if (task) {
    addSipLog(`[SIP] Disabling auto-open for ${login}. Unregistering...`);
    unregisterSip(task);
    activeTasks.delete(login);
  }
}

export function disableAutoOpenByDevice(deviceId: number) {
  for (const [login, task] of activeTasks.entries()) {
    if (task.deviceId === deviceId) {
      addSipLog(`[SIP] Disabling auto-open for device ${deviceId} (login ${login}). Unregistering...`);
      unregisterSip(task);
      activeTasks.delete(login);
    }
  }
}

export function addSipLog(message: string, type: "info" | "error" = "info") {
  const log: SipLog = { timestamp: Date.now(), message, type };
  sipLogs.unshift(log);
  if (sipLogs.length > 200) {
    sipLogs.length = 200; // keep only latest 200 logs
  }
  if (type === "error") {
    console.error(message);
  } else {
    console.log(message);
  }
}

function startCleanupTask() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [login, task] of activeTasks.entries()) {
      if (task.expiresAt && now > task.expiresAt) {
        addSipLog(`[SIP] Auto-open expired for ${login}. Unregistering...`, "info");
        unregisterSip(task);
        activeTasks.delete(login);
      }
    }
  }, 60000); // Check every minute
}

function md5(s: string) {
  return crypto.createHash("md5").update(s).digest("hex");
}

function generateBranch() {
  return "z9hG4bK" + crypto.randomBytes(8).toString("hex");
}

function generateTag() {
  return crypto.randomBytes(4).toString("hex");
}

function parseDigestChallenge(wwwAuthenticate: any) {
  const challenge = wwwAuthenticate[0] || wwwAuthenticate;
  return challenge;
}

function stripQuotes(s: string) {
  if (typeof s === "string" && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

function buildAuthorizationString(
  challenge: any,
  username: string,
  password: string,
  providedRealm: string,
  method: string,
  uri: string
) {
  const realm = providedRealm; // Use credentials realm like domru-ha
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const nonce = stripQuotes(challenge.nonce);
  const qopRaw = stripQuotes(challenge.qop || "");
  let qop = "";
  if (qopRaw.includes("auth")) {
    qop = "auth";
  }
  const algorithm = stripQuotes(challenge.algorithm || "MD5");
  
  if (qop === "auth") {
    const cnonce = crypto.randomBytes(4).toString("hex");
    const nc = "00000001";
    const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=${algorithm}, cnonce="${cnonce}", nc=${nc}, qop=${qop}`;
  } else {
    const response = md5(`${ha1}:${nonce}:${ha2}`);
    return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}", algorithm=${algorithm}`;
  }
}

export function startSipServer() {
  if (isSipStarted) return;

  sip.start(
    {
      port: 5060,
    },
    (request: any) => {
      // Handle incoming SIP requests
      if (request.method === "INVITE") {
        const toUri = request.headers.to.uri;
        let login = "";
        if (typeof toUri === "object") {
          login = toUri.user;
        } else {
          login = toUri.match(/sip:(.*)@/)?.[1] || "";
        }

        addSipLog(`[SIP] Received INVITE for ${login}`);

        const task = activeTasks.get(login);
        if (task) {
          addSipLog(`[SIP] Auto-open active for ${login}. Accepting call...`);
          
          // 1. Send 180 Ringing
          const ringing = sip.makeResponse(request, 180, "Ringing");
          sip.send(ringing);

          // 2. Send 200 OK (Answer)
          setTimeout(async () => {
            const ok = sip.makeResponse(request, 200, "OK");
            ok.headers.contact = [{ uri: request.headers.to.uri }];
            // Dummy SDP just to establish the session
            ok.content = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nc=IN IP4 127.0.0.1\r\nt=0 0\r\nm=audio 10000 RTP/AVP 0\r\n";
            ok.headers["content-type"] = "application/sdp";
            sip.send(ok);

            // 3. Trigger door open API
            try {
              await task.onOpenDoor();
              addSipLog(`[SIP] Door opened for ${login}.`);
            } catch (err: any) {
              addSipLog(`[SIP] Failed to open door for ${login}: ${err.message || err}`, "error");
            }

            if (task.opensRemaining !== null && task.opensRemaining !== undefined) {
              task.opensRemaining--;
            }

            if (task.opensRemaining === null || task.opensRemaining === undefined || task.opensRemaining > 0) {
              addSipLog(`[SIP] Call handled. Remaining opens: ${task.opensRemaining === null ? 'unlimited' : task.opensRemaining}.`);
            } else {
              addSipLog(`[SIP] Guest limit reached for ${login}. Unregistering...`);
              unregisterSip(task);
              activeTasks.delete(login);
            }

          }, 500); // slight delay
        } else {
          addSipLog(`[SIP] No active auto-open for ${login}. Rejecting.`);
          const busy = sip.makeResponse(request, 486, "Busy Here");
          sip.send(busy);
        }
      } else if (request.method === "BYE") {
        sip.send(sip.makeResponse(request, 200, "OK"));
      } else {
        // Method Not Allowed
        sip.send(sip.makeResponse(request, 405, "Method Not Allowed"));
      }
    }
  );
  isSipStarted = true;
  startCleanupTask();
  addSipLog("[SIP] SIP Server started on port 5060.");
}

function sendRegister(task: AutoOpenTask, challenge?: any) {
  const { login, password, realm } = task.credentials;
  const uri = `sip:${realm}`;
  const userUri = `sip:${login}@${realm}`;
  
  if (!task.callId) {
    task.callId = crypto.randomBytes(8).toString("hex");
  }
  if (!task.fromTag) {
    task.fromTag = generateTag();
  }
  
  const rq: any = {
    method: "REGISTER",
    uri,
    headers: {
      to: { uri: userUri },
      from: { uri: userUri, params: { tag: task.fromTag } },
      "call-id": task.callId,
      cseq: { method: "REGISTER", seq: challenge ? 2 : 1 },
      contact: [{ uri: `sip:${login}@0.0.0.0:5060;transport=udp` }],
      expires: 60,
      "user-agent": "Myhome/Myhome-android",
      supported: "replaces, outbound, gruu, path",
      "max-forwards": 70,
    },
  };

  if (challenge) {
    const authString = buildAuthorizationString(challenge, login, password, realm, "REGISTER", uri);
    rq.headers.authorization = authString;
    addSipLog(`[SIP] Built auth string: ${authString}`);
  }

  sip.send(rq, (rs: any) => {
    if (rs.status >= 100 && rs.status < 200) {
      addSipLog(`[SIP] Received provisional response: ${rs.status} ${rs.reason}`);
    } else if (rs.status === 401 && !challenge) {
      // Handle authentication challenge
      const authHeader = rs.headers["www-authenticate"];
      if (authHeader) {
        sendRegister(task, parseDigestChallenge(authHeader));
      } else {
        addSipLog(`[SIP] 401 response missing www-authenticate header`, "error");
      }
    } else if (rs.status === 200) {
      addSipLog(`[SIP] Successfully registered ${login} at ${realm}`);
    } else {
      addSipLog(`[SIP] Registration failed for ${login}: ${rs.status} ${rs.reason}`, "error");
    }
  });
}

function unregisterSip(task: AutoOpenTask) {
  const { login, realm } = task.credentials;
  const uri = `sip:${realm}`;
  const userUri = `sip:${login}@${realm}`;

  const rq: any = {
    method: "REGISTER",
    uri,
    headers: {
      to: { uri: userUri },
      from: { uri: userUri, params: { tag: generateTag() } },
      "call-id": crypto.randomBytes(8).toString("hex"),
      cseq: { method: "REGISTER", seq: 1 },
      contact: [{ uri: `sip:${login}@0.0.0.0:5060;transport=udp` }],
      expires: 0, // 0 means unregister
      "user-agent": "Myhome/Myhome-android",
    },
  };

  sip.send(rq, (rs: any) => {
    // If it challenges, we can technically respond, but for unregistering usually we might just let it fail or respond.
    // For simplicity, we just send it.
    addSipLog(`[SIP] Unregistration sent for ${login}.`);
  });
}
