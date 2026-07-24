import { AppCredentials } from "../types";

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  subscriptionsCount: number;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    console.warn("[Push] Service Worker is not supported in this browser.");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/"
    });
    console.log("[Push] Service Worker registered successfully:", registration.scope);
    return registration;
  } catch (err) {
    console.error("[Push] Service Worker registration failed:", err);
    return null;
  }
}

export async function getPushStatus(credentials?: AppCredentials): Promise<PushStatus> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  if (!supported) {
    return {
      supported: false,
      permission: "unsupported",
      isSubscribed: false,
      subscriptionsCount: 0
    };
  }

  const permission = Notification.permission;
  let isSubscribed = false;
  let subscriptionsCount = 0;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      isSubscribed = !!subscription;
    }

    if (credentials) {
      const authHeader = `Bearer ${btoa(encodeURIComponent(JSON.stringify(credentials)))}`;
      const res = await fetch("/api/push/status", {
        headers: { Authorization: authHeader }
      });
      if (res.ok) {
        const data = await res.json();
        subscriptionsCount = data.subscriptionsCount || 0;
      }
    }
  } catch (e) {
    console.error("[Push] Error fetching push status:", e);
  }

  return {
    supported: true,
    permission,
    isSubscribed,
    subscriptionsCount
  };
}

export async function subscribeToPush(credentials: AppCredentials): Promise<boolean> {
  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error("Service Worker не поддерживается вашим браузером");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Разрешение на отправку уведомлений отклонено у пользователя");
  }

  // 1. Fetch VAPID public key from backend
  const keyRes = await fetch("/api/push/vapid-public-key");
  if (!keyRes.ok) {
    throw new Error("Не удалось получить VAPID публичный ключ с сервера");
  }
  const { publicKey } = await keyRes.json();
  if (!publicKey) {
    throw new Error("Публичный VAPID ключ отсутствует");
  }

  // 2. Subscribe via browser PushManager
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });

  // 3. Send subscription object to backend (use explicit toJSON() for Safari/iOS compatibility)
  const subPayload = subscription.toJSON ? subscription.toJSON() : subscription;
  const authHeader = `Bearer ${btoa(encodeURIComponent(JSON.stringify(credentials)))}`;
  const subRes = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader
    },
    body: JSON.stringify(subPayload)
  });


  if (!subRes.ok) {
    const err = await subRes.json().catch(() => ({}));
    throw new Error(err.error || "Ошибка сохранения подписки на сервере");
  }

  console.log("[Push] Successfully subscribed to Web Push notifications.");
  return true;
}

export async function unsubscribeFromPush(credentials: AppCredentials): Promise<boolean> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      const authHeader = `Bearer ${btoa(encodeURIComponent(JSON.stringify(credentials)))}`;
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader
        },
        body: JSON.stringify({ endpoint })
      });
    }
  }
  return true;
}

export interface PushDeviceItem {
  id: string;
  endpoint: string;
  userAgent?: string;
  createdAt: string;
}

export async function fetchPushSubscriptions(credentials: AppCredentials): Promise<PushDeviceItem[]> {
  const authHeader = `Bearer ${btoa(encodeURIComponent(JSON.stringify(credentials)))}`;
  const res = await fetch("/api/push/subscriptions", {
    headers: { Authorization: authHeader }
  });

  if (!res.ok) {
    throw new Error("Не удалось получить список подключенных устройств");
  }

  return await res.json();
}

export async function deletePushSubscriptionById(credentials: AppCredentials, id: string): Promise<boolean> {
  const authHeader = `Bearer ${btoa(encodeURIComponent(JSON.stringify(credentials)))}`;
  const res = await fetch(`/api/push/subscriptions/${id}`, {
    method: "DELETE",
    headers: { Authorization: authHeader }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Не удалось удалить устройство");
  }

  return true;
}

export async function clearAllPushSubscriptions(credentials: AppCredentials): Promise<boolean> {
  const authHeader = `Bearer ${btoa(encodeURIComponent(JSON.stringify(credentials)))}`;
  const res = await fetch("/api/push/subscriptions/clear", {
    method: "POST",
    headers: { Authorization: authHeader }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Не удалось очистить список устройств");
  }

  return true;
}

export async function sendTestPush(credentials: AppCredentials): Promise<boolean> {
  const authHeader = `Bearer ${btoa(encodeURIComponent(JSON.stringify(credentials)))}`;
  const res = await fetch("/api/push/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Ошибка отправки тестового уведомления");
  }

  const data = await res.json();
  if (data.result && data.result.success === 0) {
    throw new Error("Уведомление отправлено, но нет активных подключенных устройств.");
  }

  return true;
}

