// Service worker Antre-in: hanya untuk web push (tidak melakukan caching).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* payload bukan JSON */ }
  event.waitUntil(
    self.registration.showNotification(d.title || "Antre-in", {
      body: d.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: d.url || "antre",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.includes(url) && "focus" in c) return c.focus();
      return self.clients.openWindow(url);
    }),
  );
});
