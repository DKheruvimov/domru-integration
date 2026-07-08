import { createRequire } from "module";
const require = createRequire("file://" + process.cwd() + "/");
const sip = require("sip");

import * as crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { DATA_DIR } from "./config.js";
import { DomruClient } from "../src/domru-api/index.js";
import { loadSavedTokens } from "./tokenStore.js";
import { getSettings } from "./settings-manager.js";
import { broadcastAutoOpenStatusChanged, broadcastSipLogAdded, broadcastIncomingCall } from "./ws-manager.js";

export async function triggerDoorOpenForLogin(login: string, placeId: number, deviceId: number, details?: string): Promise<void> {
  const tokens = loadSavedTokens();
  const creds = Object.values(tokens).find(c => c.login === login) || Object.values(tokens)[0];
  if (!creds) {
    throw new Error("No saved credentials found");
  }

  if (creds.isDemo) {
    addSipLog(`[DEMO] Door opened via schedule for place ${placeId}, device ${deviceId}`);
    const { recordDoorOpening } = await import("./openings-manager.js");
    recordDoorOpening(Number(placeId), Number(deviceId), "auto", details || "Авто-открытие SIP (Демо)");
    return;
  }

  const client = new DomruClient({
    login: creds.login,
    password: creds.password,
    refreshToken: creds.refreshToken,
    operatorId: creds.operatorId,
    timeout: 10000,
    logger: {
      info: (msg: string, ...args: any[]) => console.log(`[DomruClient:INFO] ${msg}`, ...args),
      warn: (msg: string, ...args: any[]) => console.warn(`[DomruClient:WARN] ${msg}`, ...args),
      error: (msg: string, ...args: any[]) => console.error(`[DomruClient:ERROR] ${msg}`, ...args),
      debug: (msg: string, ...args: any[]) => console.log(`[DomruClient:DEBUG] ${msg}`, ...args),
    }
  });

  await client.openDoor(Number(placeId), Number(deviceId));
  const { recordDoorOpening } = await import("./openings-manager.js");
  recordDoorOpening(Number(placeId), Number(deviceId), "auto", details || "Авто-открытие SIP");
}

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

export interface SipDeviceBinding {
  login: string;
  password: string;
  realm: string;
  placeId: number;
  deviceId: number;
  callId?: string;
  fromTag?: string;
  currentCSeq?: number;
}

export interface AutoOpenTask {
  placeId: number;
  deviceId: number;
  credentials: SipCredentials;
  onOpenDoor: () => Promise<void>;
  expiresAt: number;
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
const permanentBindings = new Map<string, SipDeviceBinding>(); // login -> Binding

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

interface RingingCall {
  login: string;
  request: any;
  timeoutId: NodeJS.Timeout;
}
const ringingCalls = new Map<string, RingingCall>(); // login -> RingingCall

const sipLogs: SipLog[] = [];

export function getSipLogs() {
  return sipLogs;
}

export function getActiveTasks() {
  return Array.from(activeTasks.values());
}

export function getPermanentBindings() {
  return Array.from(permanentBindings.values());
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
        domruCredentials: task.domruCredentials,
      });
    }
    fs.writeFileSync(SIP_TASKS_FILE, JSON.stringify(tasksArray, null, 2), "utf-8");
    broadcastAutoOpenStatusChanged();
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
            if (taskData.domruCredentials.accessToken) {
              const ctx = (client as any).ctx;
              if (ctx) {
                ctx.accessToken = taskData.domruCredentials.accessToken;
                ctx.accessTokenExpiresAt = Date.now() + 60 * 60 * 1000;
              }
            }
            await client.openDoor(Number(taskData.placeId), Number(taskData.deviceId));
            const { recordDoorOpening } = await import("./openings-manager.js");
            recordDoorOpening(Number(taskData.placeId), Number(taskData.deviceId), "auto", `Временное авто-открытие SIP (${taskData.credentials?.login})`);
          } else {
            addSipLog(`[SIP] No Domru credentials to open door for ${taskData.credentials?.login}`, "error");
          }
        }
      };

      activeTasks.set(task.credentials.login, task);
      addSipLog(`[SIP] Resumed auto-open for ${task.credentials.login} (expires at ${new Date(task.expiresAt).toLocaleTimeString()}). Registering...`);
      
      // Ensure there is a binding for this task
      if (!permanentBindings.has(task.credentials.login)) {
        addPermanentBinding({
          login: task.credentials.login,
          password: task.credentials.password,
          realm: task.credentials.realm,
          placeId: task.placeId,
          deviceId: task.deviceId
        });
      }
      resumedCount++;
    }

    if (hasChanges) {
      saveActiveTasks();
    }
  } catch (err: any) {
    addSipLog(`[SIP] Failed to load/resume active tasks: ${err.message || err}`, "error");
  }
}

export function addPermanentBinding(binding: SipDeviceBinding) {
  if (!permanentBindings.has(binding.login)) {
    permanentBindings.set(binding.login, binding);
    addSipLog(`[SIP] Added permanent binding for ${binding.login}`);
    startSipServer();
    sendRegister(binding);
  }
}

export function removePermanentBinding(login: string) {
  const binding = permanentBindings.get(login);
  if (binding) {
    addSipLog(`[SIP] Removing permanent binding for ${login}`);
    unregisterSip(binding);
    permanentBindings.delete(login);
  }
}

export function enableAutoOpen(task: AutoOpenTask) {
  task.opensRemaining = task.maxOpens;
  activeTasks.set(task.credentials.login, task);
  saveActiveTasks();
  addSipLog(`[SIP] Enabled auto-open for ${task.credentials.login} (expires at ${new Date(task.expiresAt).toLocaleTimeString()}).`);
  
  // Ensure we are registered
  if (!permanentBindings.has(task.credentials.login)) {
    addPermanentBinding({
      login: task.credentials.login,
      password: task.credentials.password,
      realm: task.credentials.realm,
      placeId: task.placeId,
      deviceId: task.deviceId
    });
  }
}

export function disableAutoOpen(login: string) {
  const task = activeTasks.get(login);
  if (task) {
    addSipLog(`[SIP] Disabling auto-open for ${login}.`);
    activeTasks.delete(login);
    saveActiveTasks();
  }
}

export function disableAutoOpenByDevice(deviceId: number) {
  let hasChanges = false;
  for (const [login, task] of activeTasks.entries()) {
    if (task.deviceId === deviceId) {
      addSipLog(`[SIP] Disabling auto-open for device ${deviceId} (login ${login}).`);
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
  broadcastSipLogAdded(log);
}

function startCleanupTask() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let hasChanges = false;
    for (const [login, task] of activeTasks.entries()) {
      if (task.expiresAt && now > task.expiresAt) {
        addSipLog(`[SIP] Auto-open expired for ${login}.`, "info");
        activeTasks.delete(login);
        hasChanges = true;
      }
    }
    if (hasChanges) {
      saveActiveTasks();
    }
    
    // Refresh all permanent SIP bindings
    for (const binding of permanentBindings.values()) {
      sendRegister(binding);
    }
  }, 45000); // Check every 45 seconds
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
  const realm = providedRealm;
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

async function triggerSnapshotForLogin(login: string, placeId: number, deviceId: number) {
  addSipLog(`[SIP] Triggering camera snapshot for place ${placeId}, device ${deviceId}...`);
  try {
    const tokens = loadSavedTokens();
    const creds = Object.values(tokens).find(c => c.login === login) || Object.values(tokens)[0];
    if (!creds) {
      addSipLog(`[SIP] No saved credentials found for snapshot`, "error");
      return;
    }

    if (creds.isDemo) {
      const { addMockSnapshot } = await import("./snapshots-manager.js");
      await addMockSnapshot(login, placeId, deviceId);
      addSipLog(`[DEMO] Created mock snapshot for place ${placeId}, device ${deviceId}`);
      return;
    }

    const client = new DomruClient({
      login: creds.login,
      password: creds.password,
      refreshToken: creds.refreshToken,
      operatorId: creds.operatorId,
      timeout: 10000,
      logger: {
        info: (msg: string, ...args: any[]) => console.log(`[SnapshotClient:INFO] ${msg}`, ...args),
        warn: (msg: string, ...args: any[]) => console.warn(`[SnapshotClient:WARN] ${msg}`, ...args),
        error: (msg: string, ...args: any[]) => console.error(`[SnapshotClient:ERROR] ${msg}`, ...args),
        debug: (msg: string, ...args: any[]) => console.log(`[SnapshotClient:DEBUG] ${msg}`, ...args),
      }
    });

    const snapshot = await client.getSnapshot(Number(placeId), Number(deviceId));
    if (snapshot && snapshot.length > 0) {
      const { addSnapshot } = await import("./snapshots-manager.js");
      const entry = await addSnapshot(login, Number(placeId), Number(deviceId), snapshot);
      addSipLog(`[SIP] Camera snapshot successfully saved: ${entry.fileName} (${snapshot.length} bytes)`);
    } else {
      addSipLog(`[SIP] Camera snapshot returned empty buffer`, "error");
    }
  } catch (err: any) {
    addSipLog(`[SIP] Failed to save camera snapshot: ${err.message || err}`, "error");
  }
}

export function startSipServer() {
  if (isSipStarted) return;

  sip.start(
    {
      port: 5060,
    },
    async (request: any) => {
      // Handle incoming SIP requests
      if (request.method === "INVITE") {
        const callId = request.headers["call-id"];
        if (activeDialogs.has(callId)) {
          // This is a retransmission, ignore it so we don't trigger multiple snapshots/answers
          return;
        }

        const toUri = request.headers.to.uri;
        let login = "";
        if (typeof toUri === "object") {
          login = toUri.user;
        } else {
          login = toUri.match(/sip:(.*)@/)?.[1] || "";
        }

        activeDialogs.set(callId, {
          login,
          callId,
          from: request.headers.from,
          to: request.headers.to,
          cseq: request.headers.cseq.seq
        });

        addSipLog(`[SIP] Received INVITE for ${login}`);

        // Retrieve placeId and deviceId to take snapshot and notify modules
        const binding = permanentBindings.get(login);
        const task = activeTasks.get(login);
        const snapshotPlaceId = binding?.placeId ?? task?.placeId;
        const snapshotDeviceId = binding?.deviceId ?? task?.deviceId;

        broadcastIncomingCall(login, "Incoming SIP INVITE", snapshotPlaceId, snapshotDeviceId);

        if (snapshotPlaceId && snapshotDeviceId) {
          triggerSnapshotForLogin(login, snapshotPlaceId, snapshotDeviceId).catch((err) => {
            console.error("[SIP] Background snapshot failed:", err);
          });
        }

        // 1. Check if there is an active person schedule rule (e.g. Я, Девушка, Курьер)
        let scheduleResult: any = { active: false };
        try {
          const { checkActiveSchedules } = await import("./people-manager.js");
          scheduleResult = checkActiveSchedules();
        } catch (e) {
          console.error("Failed to check active schedules", e);
        }

        const handleAutoOpenSequence = (triggerOpenDoor: () => Promise<void>, message: string, delayMs: number) => {
          addSipLog(`[SIP] ${message}. Accepting call...`);
          const ringing = sip.makeResponse(request, 180, "Ringing");
          sip.send(ringing);

          setTimeout(() => {
            const ok = sip.makeResponse(request, 200, "OK");
            ok.headers.contact = [{ uri: `sip:${login}@${localIp}:5060;transport=udp` }];
            ok.content = `v=0\r\no=- ${Math.floor(Math.random() * 1000000)} 1 IN IP4 ${localIp}\r\ns=-\r\nc=IN IP4 ${localIp}\r\nt=0 0\r\nm=audio 40000 RTP/AVP 8\r\na=rtpmap:8 PCMA/8000\r\na=sendrecv\r\n`;
            ok.headers["content-type"] = "application/sdp";
            
            if (!ok.headers.to.params || !ok.headers.to.params.tag) {
               ok.headers.to.params = ok.headers.to.params || {};
               ok.headers.to.params.tag = crypto.randomBytes(4).toString("hex");
            }
            
            try {
              sip.send(ok);
              addSipLog(`[SIP] Sent 200 OK for call ${request.headers["call-id"]}`);
            } catch (err: any) {
              addSipLog(`[SIP] Failed to send 200 OK: ${err.message || err}`, "error");
            }
            
            setTimeout(async () => {
              try {
                await triggerOpenDoor();
              } catch (err: any) {
                addSipLog(`[SIP] Failed to open door for ${login}: ${err.message || err}`, "error");
              }

              setTimeout(() => {
                const targetUri = request.headers.contact && request.headers.contact.length > 0 
                  ? request.headers.contact[0].uri 
                  : request.headers.from.uri;

                const bye: any = {
                  method: "BYE",
                  uri: targetUri,
                  headers: {
                    to: request.headers.from,
                    from: ok.headers.to,
                    "call-id": request.headers["call-id"],
                    cseq: { method: "BYE", seq: 2 },
                    contact: [{ uri: `sip:${login}@${localIp}:5060;transport=udp` }],
                    "user-agent": "Myhome/Myhome-android",
                    "max-forwards": 70
                  }
                };
                if (request.headers["record-route"]) {
                   bye.headers.route = [...request.headers["record-route"]].reverse();
                }
                try {
                  sip.send(bye);
                  addSipLog(`[SIP] Sent BYE for call ${request.headers["call-id"]}`);
                } catch (err: any) {
                  addSipLog(`[SIP] Failed to send BYE: ${err.message || err}`, "error");
                }
              }, 2000);
            }, 1000);
          }, delayMs);
        };

        if (scheduleResult.active && binding) {
          const delayMs = scheduleResult.person?.role === "resident" 
            ? getSettings().autoOpenDelayResidentMs 
            : getSettings().autoOpenDelayGuestMs;

          handleAutoOpenSequence(async () => {
            await triggerDoorOpenForLogin(login, binding.placeId, binding.deviceId, `Авто-открытие по расписанию: ${scheduleResult.person?.name || "Гость"}`);
            addSipLog(`[SIP] Door successfully opened for: ${scheduleResult.person?.name}`);
          }, scheduleResult.message, delayMs);
        } else if (task) {
          const delayMs = getSettings().autoOpenDelayGuestMs;
          handleAutoOpenSequence(async () => {
            await task.onOpenDoor();
            addSipLog(`[SIP] Door opened for ${login}.`);
            
            if (task.opensRemaining !== null && task.opensRemaining !== undefined) {
              task.opensRemaining--;
            }
            if (task.opensRemaining === null || task.opensRemaining === undefined || task.opensRemaining > 0) {
              addSipLog(`[SIP] Call handled. Remaining opens: ${task.opensRemaining === null ? 'unlimited' : task.opensRemaining}.`);
              saveActiveTasks();
            } else {
              addSipLog(`[SIP] Guest limit reached for ${login}. Disabling auto-open...`);
              activeTasks.delete(login);
              saveActiveTasks();
            }
          }, `Auto-open active for ${login}`, delayMs);
        } else {
          // MANUAL MODE INTERCEPTION: Just send Ringing and hold the request for 60 seconds
          if (permanentBindings.has(login)) {
            addSipLog(`[SIP] No active auto-open for ${login}. Holding call for manual interception...`);
            const ringing = sip.makeResponse(request, 180, "Ringing");
            sip.send(ringing);
            
            const timeoutId = setTimeout(() => {
               if (ringingCalls.has(login)) {
                 addSipLog(`[SIP] Held call for ${login} timed out.`);
                 ringingCalls.delete(login);
               }
            }, 60000);
            
            ringingCalls.set(login, {
              login,
              request,
              timeoutId
            });
          } else {
             addSipLog(`[SIP] No binding for ${login}. Rejecting.`);
             const busy = sip.makeResponse(request, 486, "Busy Here");
             sip.send(busy);
          }
        }
      } else if (request.method === "ACK") {
        addSipLog(`[SIP] Received ACK for call ${request.headers["call-id"]}`);
      } else if (request.method === "BYE" || request.method === "CANCEL") {
        addSipLog(`[SIP] Received ${request.method} for call ${request.headers["call-id"]}`);
        sip.send(sip.makeResponse(request, 200, "OK"));
        activeDialogs.delete(request.headers["call-id"]);
        
        // Find and remove if it was ringing
        for (const [login, call] of ringingCalls.entries()) {
           if (call.request.headers["call-id"] === request.headers["call-id"]) {
              clearTimeout(call.timeoutId);
              ringingCalls.delete(login);
              addSipLog(`[SIP] Removed ringing call for ${login} due to ${request.method}`);
           }
        }
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

/**
 * Triggered manually (e.g. via Alice or Yandex app).
 * If there is an active ringing call, we answer it, open door, wait 2s, and hang up.
 * If there is no active ringing call, we just execute the openDoor API as fallback.
 */
export async function handleManualOpen(placeId: number, deviceId: number, client: DomruClient, source: string = "Web"): Promise<void> {
  let matchedLogin: string | null = null;
  let matchedBinding: SipDeviceBinding | null = null;
  for (const [login, binding] of permanentBindings.entries()) {
    if (binding.placeId === placeId && binding.deviceId === deviceId) {
       matchedLogin = login;
       matchedBinding = binding;
       break;
    }
  }

  if (matchedLogin && ringingCalls.has(matchedLogin)) {
    const ringingCall = ringingCalls.get(matchedLogin)!;
    clearTimeout(ringingCall.timeoutId);
    ringingCalls.delete(matchedLogin);
    
    addSipLog(`[SIP] Intercepting manual open request for ${matchedLogin}...`);
    const request = ringingCall.request;
    const login = matchedLogin;
    
    // 1. Send 200 OK instantly
    const ok = sip.makeResponse(request, 200, "OK");
    ok.headers.contact = [{ uri: `sip:${login}@${localIp}:5060;transport=udp` }];
    ok.content = `v=0\r\no=- ${Math.floor(Math.random() * 1000000)} 1 IN IP4 ${localIp}\r\ns=-\r\nc=IN IP4 ${localIp}\r\nt=0 0\r\nm=audio 40000 RTP/AVP 8\r\na=rtpmap:8 PCMA/8000\r\na=sendrecv\r\n`;
    ok.headers["content-type"] = "application/sdp";
    if (!ok.headers.to.params || !ok.headers.to.params.tag) {
       ok.headers.to.params = ok.headers.to.params || {};
       ok.headers.to.params.tag = crypto.randomBytes(4).toString("hex");
    }
    try {
      sip.send(ok);
      addSipLog(`[SIP] Sent 200 OK for call ${request.headers["call-id"]}`);
    } catch (err: any) {
      addSipLog(`[SIP] Failed to send 200 OK: ${err.message || err}`, "error");
    }
    
    // 2. Open door immediately via API
    try {
      await client.openDoor(placeId, deviceId);
      addSipLog(`[SIP] Door opened via manual interception for ${login}.`);
      const { recordDoorOpening } = await import("./openings-manager.js");
      recordDoorOpening(Number(placeId), Number(deviceId), "manual", `Вручную (${source}, перехват)`);
    } catch (err: any) {
      addSipLog(`[SIP] Failed to open door for ${login}: ${err.message || err}`, "error");
    }
    
    // 3. Wait 2 seconds, then send BYE
    setTimeout(() => {
      const targetUri = request.headers.contact && request.headers.contact.length > 0 
        ? request.headers.contact[0].uri 
        : request.headers.from.uri;

      const bye: any = {
        method: "BYE",
        uri: targetUri,
        headers: {
          to: request.headers.from, // To their side
          from: ok.headers.to, // From our side
          "call-id": request.headers["call-id"],
          cseq: { method: "BYE", seq: 2 },
          contact: [{ uri: `sip:${login}@${localIp}:5060;transport=udp` }],
          "user-agent": "Myhome/Myhome-android",
          "max-forwards": 70
        }
      };
      if (request.headers["record-route"]) {
         bye.headers.route = [...request.headers["record-route"]].reverse();
      }
      try {
        sip.send(bye);
        addSipLog(`[SIP] Sent BYE for call ${request.headers["call-id"]}`);
      } catch (err: any) {
        addSipLog(`[SIP] Failed to send BYE: ${err.message || err}`, "error");
      }
    }, 2000);
    
  } else {
    // Fallback: Just open the door without SIP interception
    addSipLog(`[SIP] Manual open requested for place ${placeId}, device ${deviceId}, but no ringing call. Calling API directly.`);
    await client.openDoor(placeId, deviceId);
    const { recordDoorOpening } = await import("./openings-manager.js");
    recordDoorOpening(Number(placeId), Number(deviceId), "manual", `Вручную (${source})`);
  }
}

function sendRegister(binding: SipDeviceBinding, challenge?: any) {
  const { login, password, realm } = binding;
  const uri = `sip:${realm}`;
  const userUri = `sip:${login}@${realm}`;
  
  if (!binding.callId) {
    binding.callId = crypto.randomBytes(8).toString("hex");
  }
  if (!binding.fromTag) {
    binding.fromTag = generateTag();
  }
  
  if (!binding.currentCSeq) {
    binding.currentCSeq = 1;
  } else {
    binding.currentCSeq++;
  }
  
  const rq: any = {
    method: "REGISTER",
    uri,
    headers: {
      to: { uri: userUri },
      from: { uri: userUri, params: { tag: binding.fromTag } },
      "call-id": binding.callId,
      cseq: { method: "REGISTER", seq: binding.currentCSeq },
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
        sendRegister(binding, parseDigestChallenge(authHeader));
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

function unregisterSip(binding: SipDeviceBinding) {
  const { login, realm } = binding;
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
    addSipLog(`[SIP] Unregistration sent for ${login}.`);
  });
}
