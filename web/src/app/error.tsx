"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Límite de error a nivel de ruta (tolerancia a fallos). Si una página lanza un
 * error en render, en vez de una pantalla en blanco el usuario ve un mensaje
 * claro con "Reintentar" e "Ir al inicio". Además reporta el error a la
 * observabilidad propia (`/api/observability/client-error`) — los errores de un
 * error boundary de React NO llegan a `window.onerror`, por eso se reportan aquí.
 */
export default function RouteError({
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
          message: (error?.message || "Error de render").slice(0, 2000),
          stack: (error?.stack || "").slice(0, 4000),
          source: error?.digest ? `digest:${error.digest}` : undefined,
          pageUrl: typeof window !== "undefined" ? window.location.href.slice(0, 600) : undefined,
        }),
      }).catch(() => {});
    } catch {
      /* el logger nunca debe romper la app */
    }
  }, [error]);

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-[#F5F3EF] px-6 text-[#17151F]">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#FFB03A,#FF6B4A)" }} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border-2 border-slate-200 bg-white/90 p-6 text-center shadow-sm">
        <p className="text-4xl" aria-hidden="true">🛠️</p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Algo salió mal en esta página</h1>
        <p className="mt-2 text-sm text-slate-600">
          No perdiste tu trabajo: tus datos quedan guardados. Puedes reintentar o volver al inicio. Ya registramos el
          detalle para revisarlo.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => reset()}
            className="rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95"
          >
            Reintentar
          </button>
          <Link
            href="/nuevo"
            className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5]"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
