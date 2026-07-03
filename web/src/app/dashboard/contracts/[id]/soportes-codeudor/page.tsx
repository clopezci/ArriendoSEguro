"use client";

import { PartySupportsPanel } from "@/components/contracts/codebtor-supports-panel";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useParams } from "next/navigation";

export default function SoportesCodeudorPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Posventa · soportes</p>
        <h1 className="text-2xl font-bold">Soportes de ingresos (codeudor e inquilino)</h1>
        <p className="text-sm text-slate-600">
          Archivos de respaldo económico (carta laboral, colillas, extractos). Solo el arrendador puede subir o borrar;
          las demás partes pueden listar y descargar.
        </p>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      <PartySupportsPanel contractId={id} variant="page" party="codebtor" />
      <div className="mt-2">
        <PartySupportsPanel contractId={id} variant="page" party="tenant" />
      </div>
    </main>
  );
}
