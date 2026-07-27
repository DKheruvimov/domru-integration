import { Router } from "express";
import {
  getVapidPublicKey,
  addSubscription,
  removeSubscription,
  removeSubscriptionById,
  clearAllSubscriptions,
  getSubscriptionsList,
  getSubscriptionsCount,
  sendPushToAllSubscribers,
} from "../push-manager.js";
import { requireDomruAuth, getDomruInstance, isDemo } from "../domruClientHelper.js";


const router = Router();

// Public endpoint for retrieving the VAPID Public Key needed by the browser
router.get("/vapid-public-key", (req, res) => {
  try {
    const key = getVapidPublicKey();
    res.json({ publicKey: key });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to retrieve VAPID public key" });
  }
});

// Protected: Get current subscription status
router.get("/status", requireDomruAuth, (req, res) => {
  res.json({
    subscriptionsCount: getSubscriptionsCount(),
    vapidPublicKey: getVapidPublicKey(),
  });
});

// Protected: Get full list of registered push devices
router.get("/subscriptions", requireDomruAuth, (req, res) => {
  res.json(getSubscriptionsList());
});

// Protected: Subscribe a device to Web Push
router.post("/subscribe", requireDomruAuth, (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: "Invalid PushSubscription payload" });
  }

  const userAgent = req.headers["user-agent"] || "Неизвестное устройство";

  try {
    addSubscription(subscription, userAgent);
    res.json({ success: true, subscriptionsCount: getSubscriptionsCount() });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to add push subscription" });
  }
});

// Protected: Unsubscribe a device by endpoint
router.post("/unsubscribe", requireDomruAuth, (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: "Missing endpoint" });
  }

  try {
    removeSubscription(endpoint);
    res.json({ success: true, subscriptionsCount: getSubscriptionsCount() });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to remove subscription" });
  }
});

// Protected: Delete a specific device subscription by ID
router.delete("/subscriptions/:id", requireDomruAuth, (req, res) => {
  const { id } = req.params;
  try {
    const success = removeSubscriptionById(id);
    if (!success) {
      return res.status(404).json({ error: "Device subscription not found" });
    }
    res.json({ success: true, subscriptionsCount: getSubscriptionsCount() });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to delete subscription" });
  }
});

// Protected: Delete a specific device subscription by ID (POST fallback for WAF / Proxy compatibility)
router.post("/subscriptions/delete", requireDomruAuth, (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Missing device ID" });
  }
  try {
    const success = removeSubscriptionById(id);
    if (!success) {
      return res.status(404).json({ error: "Device subscription not found" });
    }
    res.json({ success: true, subscriptionsCount: getSubscriptionsCount() });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to delete subscription" });
  }
});


// Protected: Clear all device subscriptions
router.post("/subscriptions/clear", requireDomruAuth, (req, res) => {
  try {
    clearAllSubscriptions();
    res.json({ success: true, subscriptionsCount: 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to clear subscriptions" });
  }
});

// Protected: Send a test push notification
router.post("/test", requireDomruAuth, async (req, res) => {
  try {
    let placeId = 0;
    let deviceId = 0;
    let cameraId = 0;

    if (!isDemo(req)) {
      try {
        const client = getDomruInstance(req);
        const places = await client.getSubscriberPlaces();
        if (places && places.length > 0) {
          placeId = places[0].id;
          const devices = await client.getDevices(placeId);
          if (devices && devices.length > 0) {
            deviceId = devices[0].id;
          }
          const cameras = await client.getCameras();
          if (cameras && cameras.length > 0) {
            cameraId = Number(cameras[0].id) || 0;
          }
        }
      } catch (e) {
        console.error("[PushRoutes] Error resolving real camera for test push:", e);
      }
    }

    const testUrl = `/?call=true&placeId=${placeId}&deviceId=${deviceId}&cameraId=${cameraId}&isTest=true`;



    const result = await sendPushToAllSubscribers({
      title: "🔔 Тестовый звонок в домофон",
      body: "Нажмите для входа в экстренный экран вызова и трансляции с камеры",
      tag: "test-push",
      data: {
        url: testUrl,
        placeId,
        deviceId,
        cameraId,
        isTest: true,
        timestamp: new Date().toISOString(),
      },
      actions: [
        { action: "open_app", title: "📺 Открыть видеовызов" }
      ]
    });
    res.json({ success: true, result, testUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to send test push" });
  }
});

export default router;


