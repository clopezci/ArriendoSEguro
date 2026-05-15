"use client";

import { useEffect } from "react";

/**
 * Registra el service worker en `/sw.js` (PWA). En desarrollo puede
 * interferir con hot reload; si molesta, desregistra desde DevTools → Application.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sin ruido si el host bloquea SW (p. ej. http inseguro) */
    });
  }, []);
  return null;
}
