/* ArriendoSeguro — service worker mínimo (PWA).
 *
 * IMPORTANTE (Next.js): no cachear navegaciones ni HTML/RSC desde la página.
 * Un cache-first en "/" dejaba ver landings viejas después de cada deploy en
 * el mismo origen (p. ej. arriendoseguro.vercel.app), mientras la URL nueva
 * del deploy mostraba el build correcto.
 */
const CACHE = "as-static-v3";
const OFFLINE_URL = "/offline.html";

/** Solo activos que cambian nombre con cada build (seguros para cache-first). */
function isFingerprintedStatic(req, url) {
  if (!url.pathname.startsWith("/")) return false;
  if (url.pathname.startsWith("/_next/static/")) return true;
  return /\.(?:js|css|woff2?|png|jpg|jpeg|gif|webp|svg|ico)(?:\?|$)/i.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Precachea la página offline para usarla como fallback de navegación.
      try {
        const cache = await caches.open(CACHE);
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        /* si falla el precache, el SW sigue funcionando igual */
      }
      await self.skipWaiting();
    })(),
  );
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

  /**
   * Documentos: network-first (siempre el servidor actual, sin contenido viejo),
   * pero si la red falla (offline), servimos la página offline precacheada.
   */
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ??
            new Response("Sin conexión", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } })
          );
        }
      })(),
    );
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
