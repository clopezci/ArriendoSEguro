"use client";

import { PartySupportsPanel } from "@/components/contracts/codebtor-supports-panel";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useParams } from "next/navigation";

export default function SoportesCodeudorPage() {
  const id = String(useParams<{ id: string }>().id);

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <ExpedientePostWizardNav contractId={id} />

      <header className="space-y-2">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[#17151F]">
          Soportes de ingresos (codeudor e inquilino)
        </h1>
        <p className="mt-2 text-slate-500">
          Archivos de respaldo económico (carta laboral, colillas, extractos). Solo el arrendador puede subir o borrar;
          las demás partes pueden listar y descargar.
        </p>
      </header>

      <div className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
        <PartySupportsPanel contractId={id} variant="page" party="codebtor" />
      </div>
      <div className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
        <PartySupportsPanel contractId={id} variant="page" party="tenant" />
      </div>
    </main>
  );
}
