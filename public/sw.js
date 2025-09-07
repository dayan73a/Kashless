const CACHE_NAME = "kashless-cache-v1";
const OFFLINE_URL = "/offline.html";

// Instalación: guarda offline.html en la caché
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

// Activación: limpia cachés viejas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
  self.clients.claim();
});

// Fetch: devuelve offline.html si falla una navegación
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// ---- Manejo de actualización (PASO 4) ----

// Avisar a la página cuando hay nueva versión
self.addEventListener("waiting", () => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) =>
      client.postMessage({ type: "update-ready" })
    );
  });
});

// Recibir orden de activar nueva versión
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "activate-update") {
    self.skipWaiting();
  }
});
