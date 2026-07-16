"use client";

import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { ReputationPanel } from "@/components/reputation/reputation-panel";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ReputacionContratoPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <ExpedientePostWizardNav contractId={id} />

      <header className="space-y-2">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[#17151F]">
          Calificar la experiencia de arriendo
        </h1>
        <p className="mt-2 text-slate-500">
          Califica a la otra parte por estrellas en las variables que importan en un arriendo. Es bidireccional: el
          arrendador califica al arrendatario y el arrendatario al arrendador.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/dashboard/reputacion" className="text-[#5646E5] hover:underline">
            Ver mi reputación
          </Link>
          <span className="text-slate-400">·</span>
          <Link href={`/dashboard/contracts/${id}/evidencias`} className="text-[#5646E5] hover:underline">
            Evidencias del expediente
          </Link>
        </div>
      </header>

      <div className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
        <ReputationPanel contractId={id} />
      </div>
    </main>
  );
}
