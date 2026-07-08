import crypto from "crypto";
import { loadSavedTokens } from "./tokenStore.js";
import { DomruClient } from "../src/domru-api/index.js";
import { addPermanentBinding, addSipLog } from "./sip-manager.js";

export async function initPermanentSipBindings() {
  const tokens = loadSavedTokens();
  const accounts = Object.values(tokens);
  
  if (accounts.length === 0) {
    addSipLog("[SIP Init] No saved accounts found for permanent SIP registration.");
    return;
  }

  addSipLog(`[SIP Init] Starting permanent SIP registration for ${accounts.length} accounts...`);

  for (const creds of accounts) {
    try {
      const client = new DomruClient({
        login: creds.login,
        password: creds.password,
        operatorId: creds.operatorId || 41,
      });

      const places = await client.getSubscriberPlaces();
      for (const place of places) {
        const placeId = place.place?.id || place.id;
        try {
          const devices = await client.getDevices(placeId);
          for (const dev of devices) {
            // We only need SIP for intercoms, not CCTVs
            if (dev.type !== "camera") {
              const deviceId = dev.id;
              // Generate deterministic installation ID for this integration
              const installationId = crypto.createHash('md5').update('alice_perm_' + placeId + '_' + deviceId).digest('hex').slice(0, 16);
              
              const sipCreds = await client.getSipCredentials(placeId, deviceId, installationId);
              if (sipCreds && sipCreds.login && sipCreds.password && sipCreds.realm) {
                addPermanentBinding({
                  login: sipCreds.login,
                  password: sipCreds.password,
                  realm: sipCreds.realm,
                  placeId,
                  deviceId
                });
              }
            }
          }
        } catch (devErr: any) {
           addSipLog(`[SIP Init] Failed to load devices for place ${placeId}: ${devErr.message || devErr}`, "error");
        }
      }
    } catch (e: any) {
      addSipLog(`[SIP Init] Failed to initialize SIP for account ${creds.login}: ${e.message || e}`, "error");
    }
  }
}
