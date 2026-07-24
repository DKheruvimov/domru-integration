import fs from "fs";
import path from "path";
import webpush from "web-push";
import { DATA_DIR } from "./config.js";

const VAPID_KEYS_FILE = path.join(DATA_DIR, "vapid_keys.json");
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "push_subscriptions.json");

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

import crypto from "crypto";

export interface PushSubscriptionItem {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: string;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

let vapidKeys: VapidKeys | null = null;
let subscriptions: PushSubscriptionItem[] = [];

function generateSubscriptionId(endpoint: string): string {
  return crypto.createHash("sha256").update(endpoint).digest("hex").substring(0, 16);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 1. Initialize VAPID Keys
function initVapidKeys(): VapidKeys {
  ensureDataDir();

  if (fs.existsSync(VAPID_KEYS_FILE)) {
    try {
      const data = fs.readFileSync(VAPID_KEYS_FILE, "utf-8");
      vapidKeys = JSON.parse(data);
    } catch (e) {
      console.error("[PushManager] Error reading VAPID keys, generating new ones:", e);
    }
  }

  if (!vapidKeys || !vapidKeys.publicKey || !vapidKeys.privateKey) {
    const generated = webpush.generateVAPIDKeys();
    vapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey,
    };
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys, null, 2), "utf-8");
    console.log("[PushManager] Generated new VAPID keys.");
  }

  // Set web-push VAPID details (must be a valid URL or mailto URI for Apple APNs compliance)
  webpush.setVapidDetails(
    "https://github.com/DKheruvimov/domru-integration",
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  return vapidKeys;
}

// 2. Load Subscriptions
function loadSubscriptions(): PushSubscriptionItem[] {
  ensureDataDir();
  if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
    try {
      const data = fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8");
      const raw = JSON.parse(data);
      if (Array.isArray(raw)) {
        subscriptions = raw.map((item: any) => ({
          id: item.id || generateSubscriptionId(item.endpoint),
          endpoint: item.endpoint,
          keys: item.keys,
          userAgent: item.userAgent || "Неизвестное устройство",
          createdAt: item.createdAt || new Date().toISOString(),
        }));
      } else {
        subscriptions = [];
      }
    } catch (e) {
      console.error("[PushManager] Error reading push subscriptions:", e);
      subscriptions = [];
    }
  } else {
    subscriptions = [];
  }
  return subscriptions;
}

function saveSubscriptions() {
  ensureDataDir();
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2), "utf-8");
}

// Initialize on module load
vapidKeys = initVapidKeys();
subscriptions = loadSubscriptions();

export function getVapidPublicKey(): string {
  if (!vapidKeys) {
    vapidKeys = initVapidKeys();
  }
  return vapidKeys.publicKey;
}

export function addSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  if (!sub || !sub.endpoint || !sub.keys) {
    throw new Error("Invalid subscription object");
  }

  const subId = generateSubscriptionId(sub.endpoint);
  const existingIndex = subscriptions.findIndex((s) => s.endpoint === sub.endpoint || s.id === subId);
  const newItem: PushSubscriptionItem = {
    id: subId,
    endpoint: sub.endpoint,
    keys: sub.keys,
    userAgent: userAgent || "Неизвестное устройство",
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    subscriptions[existingIndex] = {
      ...subscriptions[existingIndex],
      ...newItem,
      createdAt: subscriptions[existingIndex].createdAt || newItem.createdAt
    };
  } else {
    subscriptions.push(newItem);
  }

  saveSubscriptions();
  console.log(`[PushManager] Added subscription ${subId} (Total: ${subscriptions.length})`);
}

export function removeSubscription(endpoint: string) {
  const initialCount = subscriptions.length;
  subscriptions = subscriptions.filter((s) => s.endpoint !== endpoint);
  if (subscriptions.length !== initialCount) {
    saveSubscriptions();
    console.log(`[PushManager] Removed subscription (Total: ${subscriptions.length})`);
  }
}

export function removeSubscriptionById(id: string): boolean {
  const initialCount = subscriptions.length;
  subscriptions = subscriptions.filter((s) => s.id !== id);
  if (subscriptions.length !== initialCount) {
    saveSubscriptions();
    console.log(`[PushManager] Removed subscription by ID ${id} (Total: ${subscriptions.length})`);
    return true;
  }
  return false;
}

export function clearAllSubscriptions() {
  subscriptions = [];
  saveSubscriptions();
  console.log("[PushManager] Cleared all push subscriptions.");
}

export function getSubscriptionsList() {
  return subscriptions.map((s) => ({
    id: s.id,
    endpoint: s.endpoint,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
  }));
}

export function getSubscriptionsCount(): number {

  return subscriptions.length;
}

export async function sendPushToAllSubscribers(payload: PushPayload): Promise<{ success: number; failed: number }> {
  if (subscriptions.length === 0) {
    console.log("[PushManager] No active push subscriptions.");
    return { success: 0, failed: 0 };
  }

  const payloadString = JSON.stringify(payload);
  let successCount = 0;
  let failedCount = 0;
  const expiredEndpoints: string[] = [];

  const sendPromises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payloadString,
        {
          TTL: 60, // 60 seconds TTL for doorbell calls
          urgency: "high",
        }
      );
      successCount++;
    } catch (error: any) {
      failedCount++;
      // If 404 or 410, subscription has expired or unsubscribed
      if (error.statusCode === 404 || error.statusCode === 410) {
        expiredEndpoints.push(sub.endpoint);
      } else {
        console.error(`[PushManager] Error sending push to ${sub.endpoint.substring(0, 30)}...`, error.message || error);
      }
    }
  });

  await Promise.all(sendPromises);

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    expiredEndpoints.forEach((ep) => removeSubscription(ep));
  }

  console.log(`[PushManager] Push notification sent to ${successCount}/${subscriptions.length} devices (Failed: ${failedCount})`);
  return { success: successCount, failed: failedCount };
}
