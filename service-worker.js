// Service Worker de Mis Finanzas — cache-first del app shell, 100% offline.
// IMPORTANTE: sube este número cada vez que cambies cualquier archivo cacheado
// para que los usuarios reciban la nueva versión (ver js/app.js: aviso de actualización).
const CACHE_VERSION = "v1";
const CACHE_NAME = `mis-finanzas-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "js/app.js",
  "js/db.js",
  "js/state.js",
  "js/router.js",
  "js/format.js",
  "js/crypto-pin.js",
  "js/charts.js",
  "js/views/onboarding.js",
  "js/views/lock.js",
  "js/views/dashboard.js",
  "js/views/space-detail.js",
  "js/views/calendar.js",
  "js/views/history.js",
  "js/views/profile.js",
  "js/components/modal.js",
  "js/components/toast.js",
  "js/components/nav.js",
  "js/components/transaction-form.js",
  "js/components/space-card.js",
  "js/components/space-form.js",
  "js/components/goal-progress.js",
  "icons/icon.svg",
  "icons/icon-maskable.svg",
];

// CACHE_VERSION se actualizó a la hora de agregar este comentario — súbelo cada
// vez que cambies un archivo listado arriba para que los usuarios reciban la
// nueva versión (ver aviso "Hay una nueva versión disponible" en js/app.js).

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.error("[SW] Error precacheando:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("mis-finanzas-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") return caches.match("index.html");
          return new Response("", { status: 504, statusText: "Sin conexión" });
        });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
