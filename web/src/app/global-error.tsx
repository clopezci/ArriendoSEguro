"use client";

import { useEffect } from "react";

/**
 * Límite de error GLOBAL: captura fallos en el layout raíz (donde `error.tsx` no
 * alcanza). Debe renderizar su propio <html>/<body>. Fallback mínimo y seguro.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      void fetch("/api/observability/client-error", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          kind: "error",
          message: (error?.message || "Error global").slice(0, 2000),
          stack: (error?.stack || "").slice(0, 4000),
          source: "global-error",
          pageUrl: typeof window !== "undefined" ? window.location.href.slice(0, 600) : undefined,
        }),
      }).catch(() => {});
    } catch {
      /* no-op */
    }
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F5F3EF", color: "#17151F", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: "center", background: "#fff", border: "2px solid #e2e8f0", borderRadius: 24, padding: 24 }}>
            <p style={{ fontSize: 40, margin: 0 }}>🛠️</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>La aplicación tuvo un problema</h1>
            <p style={{ fontSize: 14, color: "#475569", marginTop: 8 }}>
              Intenta recargar. Si continúa, vuelve más tarde; ya registramos el detalle.
            </p>
            <button
              onClick={() => reset()}
              style={{ marginTop: 20, background: "#5646E5", color: "#fff", border: 0, borderRadius: 16, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}
            >
              Recargar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
