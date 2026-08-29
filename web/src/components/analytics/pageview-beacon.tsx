"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Envía un "beacon" de visita en cada cambio de ruta. Sin cookies ni datos
 * personales: el servidor solo agrega conteos (ver `pageviews.ts`). Usa
 * `navigator.sendBeacon` (no bloquea la navegación) con respaldo a `fetch`.
 * No depende del consentimiento de cookies porque no almacena identificadores.
 */
export function PageviewBeacon() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;
    try {
      const body = JSON.stringify({ path: pathname });
      const url = "/api/metrics/pageview";
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        void fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
      }
    } catch {
      /* noop: una visita no contada no afecta al usuario */
    }
  }, [pathname]);

  return null;
}
