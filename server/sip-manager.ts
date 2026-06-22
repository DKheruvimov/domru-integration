import * as sip from "sip";
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
}

const activeTasks = new Map<string, AutoOpenTask>(); // login -> Task
let isSipStarted = false;

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

function buildAuthorization(
  challenge: any,
  username: string,
  password: string,
  realm: string,
  method: string,
  uri: string
) {
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const nonce = challenge.nonce;
  const qop = challenge.qop;
  let response = "";

  if (qop === "auth") {
    const cnonce = crypto.randomBytes(4).toString("hex");
    const nc = "00000001";
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    return {
      scheme: "Digest",
      username,
      realm,
      nonce,
      uri,
      response,
      algorithm: "MD5",
      cnonce,
      nc,
      qop,
    };
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
    return {
      scheme: "Digest",
      username,
      realm,
      nonce,
      uri,
      response,
      algorithm: "MD5",
    };
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

        console.log(`[SIP] Received INVITE for ${login}`);

        const task = activeTasks.get(login);
        if (task) {
          console.log(`[SIP] Auto-open active for ${login}. Accepting call...`);
          
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
              console.log(`[SIP] Door opened for ${login}.`);
            } catch (err) {
              console.error(`[SIP] Failed to open door for ${login}:`, err);
            }

            // Unregister to release call back to mobile app
            unregisterSip(task);
            activeTasks.delete(login);

          }, 500); // slight delay
        } else {
          console.log(`[SIP] No active auto-open for ${login}. Rejecting.`);
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
  console.log("[SIP] SIP Server started on port 5060.");
}

function sendRegister(task: AutoOpenTask, challenge?: any) {
  const { login, password, realm } = task.credentials;
  const uri = `sip:${realm}`;
  const userUri = `sip:${login}@${realm}`;
  
  const rq: any = {
    method: "REGISTER",
    uri,
    headers: {
      to: { uri: userUri },
      from: { uri: userUri, params: { tag: generateTag() } },
      "call-id": crypto.randomBytes(8).toString("hex"),
      cseq: { method: "REGISTER", seq: challenge ? 2 : 1 },
      contact: [{ uri: `sip:${login}@0.0.0.0:5060;transport=udp` }],
      expires: 60,
      "user-agent": "Myhome/Myhome-android",
    },
  };

  if (challenge) {
    rq.headers.authorization = [
      buildAuthorization(challenge, login, password, realm, "REGISTER", uri),
    ];
  }

  sip.send(rq, (rs: any) => {
    if (rs.status === 401 && !challenge) {
      // Handle authentication challenge
      const authHeader = rs.headers["www-authenticate"];
      if (authHeader) {
        sendRegister(task, parseDigestChallenge(authHeader));
      }
    } else if (rs.status === 200) {
      console.log(`[SIP] Successfully registered ${login} at ${realm}`);
    } else {
      console.error(`[SIP] Registration failed for ${login}: ${rs.status} ${rs.reason}`);
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
    console.log(`[SIP] Unregistration sent for ${login}.`);
  });
}

export function enableAutoOpen(task: AutoOpenTask) {
  startSipServer();
  activeTasks.set(task.credentials.login, task);
  console.log(`[SIP] Enabled auto-open for ${task.credentials.login}. Registering...`);
  sendRegister(task);
}

export function disableAutoOpen(login: string) {
  const task = activeTasks.get(login);
  if (task) {
    console.log(`[SIP] Disabling auto-open for ${login}. Unregistering...`);
    unregisterSip(task);
    activeTasks.delete(login);
  }
}
