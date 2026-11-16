// Tratamento de notificações push. Importado pelo service worker do PWA
// (vite.config.ts → workbox.importScripts), que é gerado no build como /sw.js.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "MedSystem", body: event.data.text() };
  }

  const title = data.title || "Tarefa";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: data.tag, // mesma tarefa não aparece duplicada
    renotify: !!data.tag,
    vibrate: [100, 50, 100],
    data: { url: data.url || "/tasks" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/tasks", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // App já aberto: traz para frente e vai para a tela da tarefa
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus().then((c) => (c && "navigate" in c ? c.navigate(url) : c));
        }
      }
      return clients.openWindow ? clients.openWindow(url) : undefined;
    })
  );
});
