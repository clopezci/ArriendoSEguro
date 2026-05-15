"use client";

import { CodebtorSupportsPanel } from "@/components/contracts/codebtor-supports-panel";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function SoportesCodeudorPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Paso 12 · Evidencias</p>
        <h1 className="text-2xl font-bold">Soportes del codeudor</h1>
        <p className="text-sm text-slate-600">
          Archivos de respaldo económico del codeudor solidario. Solo el arrendador puede subir o borrar; las demás
          partes pueden listar y descargar.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={`/dashboard/contracts/${id}/evidencias`} className="text-violet-700 underline">
            ← Evidencias del expediente
          </Link>
          <span className="text-slate-400">·</span>
          <Link href={`/dashboard/contracts/${id}/codebtor`} className="text-violet-700 underline">
            Paso codeudor (wizard)
          </Link>
        </div>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      <CodebtorSupportsPanel contractId={id} variant="page" />
    </main>
  );
}
