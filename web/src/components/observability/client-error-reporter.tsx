"use client";

import { useEffect } from "react";
import { isBenignClientError } from "@/lib/observability/ignore-noise";

/**
 * Captura automática de errores del navegador (alternativa propia a Sentry).
 * Engancha `window.onerror` y `unhandledrejection`, deduplica en el cliente y
 * limita cuántos envía por carga de página para no generar ruido ni costo.
 * Los envía a `/api/observability/client-error`, que agrega por huella.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const seen = new Set<string>();
    let sent = 0;
    const MAX_PER_PAGELOAD = 15;

    // Auto-recuperación del clásico "Loading chunk … failed": tras un deploy, una
    // pestaña abierta pide un chunk con hash viejo que ya no existe. Se resuelve
    // recargando UNA vez (con guarda anti-bucle) para traer el bundle nuevo.
    function isChunkLoadError(msg: string): boolean {
      return /Loading chunk [\w./-]+ failed|ChunkLoadError|Loading CSS chunk|error loading dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module/i.test(msg);
    }
    function maybeRecoverFromChunkError(msg: string) {
      if (!isChunkLoadError(msg)) return;
      try {
        const KEY = "as_chunk_reload_at";
        const last = Number(sessionStorage.getItem(KEY) || "0");
        const now = Date.now();
        if (now - last > 20000) {
          sessionStorage.setItem(KEY, String(now));
          // Da un instante para que el reporte con keepalive salga antes de recargar.
          setTimeout(() => window.location.reload(), 400);
        }
      } catch {
        /* noop */
      }
    }

    function report(payload: {
      kind: "error" | "unhandledrejection";
      message: string;
      source?: string;
      line?: number;
      column?: number;
      stack?: string;
    }) {
      try {
        const message = (payload.message || "").trim();
        if (!message) return;
        if (isBenignClientError(message)) return; // ruido de terceros: no registrar
        const key = `${payload.kind}|${message.slice(0, 200)}|${payload.source ?? ""}`;
        if (seen.has(key)) return;
        if (sent >= MAX_PER_PAGELOAD) return;
        seen.add(key);
        sent += 1;

        const body = JSON.stringify({
          kind: payload.kind,
          message: message.slice(0, 2000),
          source: payload.source?.slice(0, 500),
          line: payload.line,
          column: payload.column,
          stack: payload.stack?.slice(0, 4000),
          pageUrl: window.location.href.slice(0, 600),
        });

        void fetch("/api/observability/client-error", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {
          /* silencioso: el logger nunca debe romper la app */
        });
      } catch {
        /* no-op */
      }
    }

    function onError(event: ErrorEvent) {
      const message = event.message || String(event.error ?? "Error");
      report({
        kind: "error",
        message,
        source: event.filename || undefined,
        line: event.lineno,
        column: event.colno,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
      maybeRecoverFromChunkError(message);
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Promesa rechazada";
      report({
        kind: "unhandledrejection",
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      maybeRecoverFromChunkError(message);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
