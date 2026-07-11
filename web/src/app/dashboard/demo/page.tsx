"use client";

import Link from "next/link";

/**
 * Punto de entrada desde el panel autenticado: el recorrido visual vive en /demo (sin API ni borradores).
 */
export default function DashboardDemoPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Demo</h1>
        <p className="text-sm text-slate-600">
          El recorrido guiado con datos ficticios está en <strong className="text-slate-800">/demo</strong>. Ahí ves el
          flujo completo sin escribir en tu expediente ni consumir Plan Plus.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.12)]">
        <p className="text-sm text-slate-700">
          Para contratos e inventario reales necesitas <strong className="text-violet-700">Plan Plus</strong> activo
          desde Planes.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/demo"
            className="inline-flex items-center justify-center rounded-xl bg-[#5646E5] px-4 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] hover:brightness-105"
          >
            Abrir demo guiado
          </Link>
          <Link
            href="/dashboard/plans"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 hover:border-violet-500"
          >
            Activar Plan Plus
          </Link>
        </div>
      </div>
    </section>
  );
}
