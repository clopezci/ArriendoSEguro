"use client";

import { useEffect } from "react";

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
      report({
        kind: "error",
        message: event.message || String(event.error ?? "Error"),
        source: event.filename || undefined,
        line: event.lineno,
        column: event.colno,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      });
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
