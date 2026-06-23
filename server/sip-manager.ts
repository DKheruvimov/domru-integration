import { createRequire } from "module";
const require = createRequire("file://" + process.cwd() + "/");
const sip = require("sip");

import * as crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { DATA_DIR } from "./config.js";
import { DomruClient } from "../src/domru-js/index.js";

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "0.0.0.0";
}

const localIp = getLocalIp();

const SIP_TASKS_FILE = path.join(DATA_DIR, "sip_tasks.json");

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
  domruCredentials?: {
    login?: string;
    password?: string;
    refreshToken?: string | null;
    operatorId?: number | null;
    accessToken?: string | null;
    isDemo?: boolean;
  };
}

export interface SipLog {
  timestamp: number;
  message: string;
  type: "info" | "error";
}

const activeTasks = new Map<string, AutoOpenTask>(); // login -> Task
let isSipStarted = false;
let cleanupInterval: NodeJS.Timeout | null = null;

interface ActiveDialog {
  login: string;
  callId: string;
  from: any;
  to: any;
  route?: any[];
  cseq: number;
}
const activeDialogs = new Map<string, ActiveDialog>(); // callId -> Dialog

const sipLogs: SipLog[] = [];

export function getSipLogs() {
  return sipLogs;
}

export function getActiveTasks() {
  return Array.from(activeTasks.values());
}

export function saveActiveTasks() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tasksArray: any[] = [];
    for (const task of activeTasks.values()) {
      tasksArray.push({
        placeId: task.placeId,
        deviceId: task.deviceId,
        credentials: task.credentials,
        expiresAt: task.expiresAt,
        maxOpens: task.maxOpens,
        opensRemaining: task.opensRemaining,
        callId: task.callId,
        fromTag: task.fromTag,
        domruCredentials: task.domruCredentials,
      });
    }
    fs.writeFileSync(SIP_TASKS_FILE, JSON.stringify(tasksArray, null, 2), "utf-8");
  } catch (err: any) {
    addSipLog(`[SIP] Failed to save active tasks: ${err.message || err}`, "error");
  }
}

export function loadAndResumeActiveTasks() {
  try {
    if (!fs.existsSync(SIP_TASKS_FILE)) return;
    const content = fs.readFileSync(SIP_TASKS_FILE, "utf-8");
    const tasksArray = JSON.parse(content);
    const now = Date.now();
    let resumedCount = 0;
    let hasChanges = false;

    for (const taskData of tasksArray) {
      if (taskData.expiresAt && now > taskData.expiresAt) {
        addSipLog(`[SIP] Saved task for ${taskData.credentials?.login} has expired, skipping.`);
        hasChanges = true;
        continue;
      }

      // Recreate onOpenDoor callback
      const task: AutoOpenTask = {
        placeId: taskData.placeId,
        deviceId: taskData.deviceId,
        credentials: taskData.credentials,
        expiresAt: taskData.expiresAt,
        maxOpens: taskData.maxOpens,
        opensRemaining: taskData.opensRemaining,
        callId: taskData.callId,
        fromTag: taskData.fromTag,
        domruCredentials: taskData.domruCredentials,
        onOpenDoor: async () => {
          if (taskData.domruCredentials?.isDemo) {
            console.log(`[DEMO] Door opened via Yandex Dialogs (restored) for place ${taskData.placeId}, device ${taskData.deviceId}`);
            return;
          }

          if (taskData.domruCredentials) {
            const client = new DomruClient({
              login: taskData.domruCredentials.login,
              password: taskData.domruCredentials.password,
              refreshToken: taskData.domruCredentials.refreshToken,
              operatorId: taskData.domruCredentials.operatorId,
              timeout: 10000,
              logger: {
                info: (msg: string, ...args: any[]) => console.log(`[DomruClient:INFO] ${msg}`, ...args),
                warn: (msg: string, ...args: any[]) => console.warn(`[DomruClient:WARN] ${msg}`, ...args),
                error: (msg: string, ...args: any[]) => console.error(`[DomruClient:ERROR] ${msg}`, ...args),
                debug: (msg: string, ...args: any[]) => console.log(`[DomruClient:DEBUG] ${msg}`, ...args),
              }
            });
            // Manually inject access token if it exists
            if (taskData.domruCredentials.accessToken) {
              const ctx = (client as any).ctx;
              if (ctx) {
                ctx.accessToken = taskData.domruCredentials.accessToken;
                ctx.accessTokenExpiresAt = Date.now() + 60 * 60 * 1000;
              }
            }
            await client.openDoor(Number(taskData.placeId), Number(taskData.deviceId));
          } else {
            addSipLog(`[SIP] No Domru credentials to open door for ${taskData.credentials?.login}`, "error");
          }
        }
      };

      activeTasks.set(task.credentials.login, task);
      addSipLog(`[SIP] Resumed auto-open for ${task.credentials.login} (expires at ${new Date(task.expiresAt).toLocaleTimeString()}). Registering...`);
      startSipServer();
      sendRegister(task);
      resumedCount++;
    }

    if (hasChanges) {
      saveActiveTasks(); // clean up any expired tasks
    }
  } catch (err: any) {
    addSipLog(`[SIP] Failed to load/resume active tasks: ${err.message || err}`, "error");
  }
}

export function enableAutoOpen(task: AutoOpenTask) {
  task.opensRemaining = task.maxOpens;
  activeTasks.set(task.credentials.login, task);
  saveActiveTasks();
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
    saveActiveTasks();
  }
}

export function disableAutoOpenByDevice(deviceId: number) {
  let hasChanges = false;
  for (const [login, task] of activeTasks.entries()) {
    if (task.deviceId === deviceId) {
      addSipLog(`[SIP] Disabling auto-open for device ${deviceId} (login ${login}). Unregistering...`);
      unregisterSip(task);
      activeTasks.delete(login);
      hasChanges = true;
    }
  }
  if (hasChanges) {
    saveActiveTasks();
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
    let hasChanges = false;
    for (const [login, task] of activeTasks.entries()) {
      if (task.expiresAt && now > task.expiresAt) {
        addSipLog(`[SIP] Auto-open expired for ${login}. Unregistering...`, "info");
        unregisterSip(task);
        activeTasks.delete(login);
        hasChanges = true;
      } else {
        // Re-register to keep NAT pinhole open and refresh SIP registration
        // (Our previous REGISTER expires in 60s)
        sendRegister(task);
      }
    }
    if (hasChanges) {
      saveActiveTasks();
    }
  }, 45000); // Check every 45 seconds (must be less than expires: 60)
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
            ok.headers.contact = [{ uri: `sip:${login}@${localIp}:5060;transport=udp` }];
            ok.content = `v=0\r\no=- ${Math.floor(Math.random() * 1000000)} 1 IN IP4 ${localIp}\r\ns=-\r\nc=IN IP4 ${localIp}\r\nt=0 0\r\nm=audio 40000 RTP/AVP 8\r\na=rtpmap:8 PCMA/8000\r\na=sendrecv\r\n`;
            ok.headers["content-type"] = "application/sdp";
            
            // Add a tag to To if not present (sip.makeResponse might do this, but just to be sure)
            if (!ok.headers.to.params || !ok.headers.to.params.tag) {
               ok.headers.to.params = ok.headers.to.params || {};
               ok.headers.to.params.tag = crypto.randomBytes(4).toString("hex");
            }
            
            sip.send(ok);
            
            // Store dialog for later BYE
            activeDialogs.set(request.headers["call-id"], {
               login: login,
               callId: request.headers["call-id"],
               from: request.headers.to, // we send BYE From our side (which was To in INVITE)
               to: request.headers.from, // we send BYE To their side (which was From in INVITE)
               route: request.headers["record-route"],
               cseq: 1
            });
          }, 500); // slight delay
        } else {
          addSipLog(`[SIP] No active auto-open for ${login}. Rejecting.`);
          const busy = sip.makeResponse(request, 486, "Busy Here");
          sip.send(busy);
        }
      } else if (request.method === "ACK") {
        addSipLog(`[SIP] Received ACK for call ${request.headers["call-id"]}`);
        const dialog = activeDialogs.get(request.headers["call-id"]);
        if (dialog) {
           const login = dialog.login;
           const task = activeTasks.get(login);
           if (task) {
             // 3. Trigger door open API
             (async () => {
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
                 saveActiveTasks();
               } else {
                 addSipLog(`[SIP] Guest limit reached for ${login}. Unregistering...`);
                 unregisterSip(task);
                 activeTasks.delete(login);
                 saveActiveTasks();
               }
               
               // 4. Send BYE after 1 second
               setTimeout(() => {
                 dialog.cseq++;
                 const bye: any = {
                   method: "BYE",
                   uri: dialog.to.uri,
                   headers: {
                     to: dialog.to,
                     from: dialog.from,
                     "call-id": dialog.callId,
                     cseq: { method: "BYE", seq: dialog.cseq },
                     contact: [{ uri: `sip:${login}@${localIp}:5060;transport=udp` }],
                     "user-agent": "Myhome/Myhome-android",
                     "max-forwards": 70
                   }
                 };
                 if (dialog.route) {
                    // Reverse the record-route to get the correct route for BYE
                    bye.headers.route = [...dialog.route].reverse();
                    // Set URI to the first route URI for Kamailio/FreeSWITCH strict routing handling
                    // `sip` handles strict routing usually, but we just pass the route array
                 }
                 sip.send(bye);
                 addSipLog(`[SIP] Sent BYE for call ${dialog.callId}`);
                 activeDialogs.delete(dialog.callId);
               }, 1000);
             })();
           }
        }
      } else if (request.method === "BYE" || request.method === "CANCEL") {
        addSipLog(`[SIP] Received ${request.method} for call ${request.headers["call-id"]}`);
        sip.send(sip.makeResponse(request, 200, "OK"));
        activeDialogs.delete(request.headers["call-id"]);
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
      contact: [{ uri: `sip:${login}@${localIp}:5060;transport=udp` }],
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
      contact: [{ uri: `sip:${login}@${localIp}:5060;transport=udp` }],
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
