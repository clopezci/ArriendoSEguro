"use client";

import Link from "next/link";

/**
 * Punto de entrada desde el panel autenticado: el recorrido visual vive en /demo (sin API ni borradores).
 */
export default function DashboardDemoPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-white">Demo</h1>
        <p className="text-sm text-slate-400">
          El recorrido guiado con datos ficticios está en <strong className="text-slate-200">/demo</strong>. Ahí ves el
          flujo completo sin escribir en tu expediente ni consumir Plan Plus.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.12)]">
        <p className="text-sm text-slate-300">
          Para contratos e inventario reales necesitas <strong className="text-violet-300">Plan Plus</strong> activo
          desde Planes.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/demo"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] hover:bg-violet-500"
          >
            Abrir demo guiado
          </Link>
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-4 py-3 text-sm text-slate-200 hover:border-violet-400"
          >
            Activar Plan Plus
          </Link>
        </div>
      </div>
    </section>
  );
}
