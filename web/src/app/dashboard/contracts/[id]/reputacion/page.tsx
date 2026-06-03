"use client";

import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { ReputationPanel } from "@/components/reputation/reputation-panel";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ReputacionContratoPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Reputación</p>
        <h1 className="text-2xl font-bold">Calificar la experiencia de arriendo</h1>
        <p className="text-sm text-slate-600">
          Califica a la otra parte por estrellas en las variables que importan en un arriendo. Es bidireccional: el
          arrendador califica al arrendatario y el arrendatario al arrendador.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/dashboard/reputacion" className="text-violet-700 underline">
            Ver mi reputación
          </Link>
          <span className="text-slate-400">·</span>
          <Link href={`/dashboard/contracts/${id}/evidencias`} className="text-violet-700 underline">
            Evidencias del expediente
          </Link>
        </div>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      <ReputationPanel contractId={id} />
    </main>
  );
}
