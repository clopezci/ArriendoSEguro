/* ArriendoSeguro — service worker mínimo (PWA).
 *
 * IMPORTANTE (Next.js): no cachear navegaciones ni HTML/RSC desde la página.
 * Un cache-first en "/" dejaba ver landings viejas después de cada deploy en
 * el mismo origen (p. ej. arriendoseguro.vercel.app), mientras la URL nueva
 * del deploy mostraba el build correcto.
 */
const CACHE = "as-static-v2";

/** Solo activos que cambian nombre con cada build (seguros para cache-first). */
function isFingerprintedStatic(req, url) {
  if (!url.pathname.startsWith("/")) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return /\.(?:js|css|woff2?|png|jpg|jpeg|gif|webp|svg|ico)(?:\?|$)/i.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  /** Nunca cache-first en documentos: siempre servidor actual. */
  if (req.mode === "navigate") {
    event.respondWith(fetch(req));
    return;
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html") || accept.includes("text/x-component")) {
    event.respondWith(fetch(req));
    return;
  }

  if (!isFingerprintedStatic(req, url)) {
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
            /* ignorar fallos de cache */
          }
        }
        return res;
      } catch {
        return fetch(req);
      }
    })(),
  );
});
