/* ArriendoSeguro — service worker mínimo (PWA). Cache-first en GET estático; APIs siempre red. */
const CACHE = "as-static-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          try {
            await cache.put(req, res.clone());
          } catch {
            /* ignorar fallos de cache (opaque, tamaño, etc.) */
          }
        }
        return res;
      } catch {
        return fetch(req);
      }
    })(),
  );
});
