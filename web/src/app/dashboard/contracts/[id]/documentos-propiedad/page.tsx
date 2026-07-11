"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { PropertyDocumentsPanel } from "@/components/contracts/property-documents-panel";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";
import { getDraft } from "@/features/contracts/wizard-state";

export default function DocumentosPropiedadPage() {
  const id = String(useParams<{ id: string }>().id);
  const [contractVersionId, setContractVersionId] = useState("");
  const [isProxy, setIsProxy] = useState(false);

  useEffect(() => {
    setIsProxy(getDraft(id)?.actingAs === "proxy");
    void (async () => {
      try {
        const res = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
        const data = await res.json();
        setContractVersionId(String(data?.version?.id ?? data?.contract?.currentVersionId ?? ""));
      } catch {
        /* sin versión aún */
      }
    })();
  }, [id]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Evidencias</p>
        <h1 className="text-2xl font-bold">Documentos de propiedad / poder</h1>
        <p className="text-sm text-slate-600">
          Adjunta la escritura, el certificado de libertad y tradición o, si actúas como apoderado, el{" "}
          <strong>poder autenticado</strong>. Solo el arrendador puede subir; las partes pueden ver.
        </p>
        <Link href={`/dashboard/contracts/${id}/evidencias`} className="text-sm text-violet-700 underline">
          ← Evidencias del expediente
        </Link>
      </header>

      <ExpedientePostWizardNav contractId={id} />

      {isProxy && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Indicaste que actúas como <strong>apoderado</strong>: recuerda subir aquí el <strong>poder autenticado</strong>{" "}
          que te faculta para arrendar a nombre del propietario.
        </p>
      )}

      <p className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <strong>Privacidad:</strong> sube solo los documentos necesarios para el contrato. Si un archivo incluye datos
        de <strong>terceros</strong> o de <strong>menores de edad</strong> (por ejemplo, otros nombres en una escritura),
        asegúrate de contar con autorización para tratarlos. Tratamos esta información conforme a la Ley 1581 de 2012 y
        al{" "}
        <Link href="/legal/aviso-privacidad" className="text-violet-700 underline">
          aviso de privacidad
        </Link>
        .
      </p>

      <RequiresSavedContract id={id}>
        <PropertyDocumentsPanel contractId={id} contractVersionId={contractVersionId} highlightPoder={isProxy} />
      </RequiresSavedContract>
    </main>
  );
}
