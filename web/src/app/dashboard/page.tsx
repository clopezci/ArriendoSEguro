import Link from "next/link";

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
        <h2 className="text-2xl font-bold">Panel de usuario</h2>
        <p className="mt-2 max-w-3xl text-slate-300">
          Desde aquí podrás crear y gestionar expedientes de contrato de arrendamiento para vivienda
          urbana en Colombia.
        </p>
        <div className="mt-4">
          <Link
            href="/dashboard/contracts"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.4)] hover:bg-violet-500"
          >
            Ir al módulo contractual
          </Link>
          <Link
            href="/dashboard/billing"
            className="ml-2 rounded-lg border border-violet-400 px-4 py-2 text-sm font-medium text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.2)]"
          >
            Ver facturación
          </Link>
        </div>
      </div>
    </section>
  );
}

