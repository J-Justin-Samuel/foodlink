// FoodLink service worker: shows "food expiring near you" alerts and opens the app when tapped.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title || "FoodLink", {
      body: data.body || "",
      tag: data.tag,
      data: { url: data.url || "/volunteer/discover" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if ("focus" in w) {
            w.navigate(url);
            return w.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
