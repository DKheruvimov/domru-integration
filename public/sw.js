// Service Worker for Dom.ru Intercom PWA & Web Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notification
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: "🔔 Уведомление",
      body: event.data.text()
    };
  }

  const title = payload.title || "🔔 Звонок в домофон";
  const options = {
    body: payload.body || "Входная дверь",
    icon: payload.icon || "/icon-192.png",
    image: payload.image || undefined,
    tag: payload.tag || "domru-intercom-push",
    data: payload.data || {},
    actions: payload.actions || [
      { action: "open_door", title: "🚪 Открыть дверь" }
    ],
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true // Keep notification on screen until user interacts
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click and action buttons
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  // If user clicked the "Open Door" action button directly from lockscreen/notification banner
  if (action === "open_door") {
    event.waitUntil(
      (async () => {
        try {
          // Send background POST request to open the door
          const response = await fetch("/api/domru/open", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              placeId: data.placeId,
              deviceId: data.deviceId
            })
          });

          if (response.ok) {
            await self.registration.showNotification("✅ Дверь открыта!", {
              body: "Команда на открытие замка успешно отправлена.",
              icon: "/icon-192.png",
              tag: "door-opened-success",
              timeout: 3000
            });
          } else {
            const err = await response.json().catch(() => ({}));
            await self.registration.showNotification("⚠️ Ошибка открытия", {
              body: err.error || "Не удалось открыть дверь",
              icon: "/icon-192.png",
              tag: "door-opened-error"
            });
          }
        } catch (e) {
          console.error("[SW] Error opening door from notification action:", e);
        }
      })()
    );
    return;
  }

  // Default click on notification body -> Open or focus app window
  const urlToOpen = (data && data.url) ? data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
