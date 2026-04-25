"use client";

import { useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, updateDraft } from "@/features/contracts/wizard-state";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function ReviewStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-300">Cargando…</p>;

  const cap = Number(draft.property.legalRentCap ?? 0);
  const rent = Number(draft.lease.monthlyRent ?? draft.property.monthlyRentProposed ?? 0);
  const capExceeded = rent > cap;

  return (
    <WizardShell title="Resumen previo" currentStep={8} contractId={id}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Arrendador">
          <p>{draft.landlord.fullName}</p>
          <p>{draft.landlord.documentType} {draft.landlord.documentNumber}</p>
          <p>{draft.landlord.email}</p>
        </Card>
        <Card title="Arrendatario">
          <p>{draft.tenant.fullName}</p>
          <p>{draft.tenant.documentType} {draft.tenant.documentNumber}</p>
          <p>{draft.tenant.email}</p>
        </Card>
        <Card title="Codeudor">
          {draft.hasSolidaryCoDebtor ? (
            <>
              <p>{draft.solidaryCoDebtor.fullName}</p>
              <p>{draft.solidaryCoDebtor.documentType} {draft.solidaryCoDebtor.documentNumber}</p>
            </>
          ) : (
            <p>Sin codeudor solidario.</p>
          )}
        </Card>
        <Card title="Inmueble y canon">
          <p>{draft.property.address}</p>
          <p>Canon propuesto: ${rent.toLocaleString("es-CO")}</p>
          <p>Canon máximo estimado: ${cap.toLocaleString("es-CO")}</p>
        </Card>
        <Card title="Términos">
          <p>Duración: {draft.lease.termMonths} meses</p>
          <p>Pago: {draft.lease.paymentMethod}</p>
          <p>Día de pago: {draft.lease.paymentDueDay}</p>
        </Card>
        <Card title="Servicios">
          <p>Responsable: {draft.utilities.responsibleParty}</p>
          <p>{draft.utilities.details}</p>
        </Card>
      </div>

      <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-300">
        <p className="font-medium text-violet-300">Alertas legales</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>No se permite depósito en dinero en este flujo de vivienda urbana.</li>
          <li>Arriendo Seguro no recauda dinero ni garantiza pagos.</li>
          {capExceeded ? (
            <li className="text-rose-300">
              El canon propuesto supera el máximo estimado. Debes editar inmueble/términos.
            </li>
          ) : (
            <li className="text-emerald-300">Canon dentro del límite legal estimado.</li>
          )}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/dashboard/contracts/${id}/landlord`}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-violet-400"
        >
          Editar datos
        </Link>
        <button
          type="button"
          onClick={() => {
            updateDraft(id, (d) => appendAudit(d, "contract_draft_saved"));
            router.push(`/dashboard/contracts/${id}/preview`);
          }}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
        >
          Generar vista previa
        </button>
        <button
          type="button"
          onClick={() => {
            updateDraft(id, (d) => appendAudit(d, "contract_draft_saved"));
            alert("Borrador guardado.");
          }}
          className="rounded-lg border border-violet-400 px-4 py-2 text-sm font-medium text-violet-200"
        >
          Guardar borrador
        </button>
      </div>
    </WizardShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="mb-2 text-sm font-semibold text-violet-300">{title}</h3>
      <div className="space-y-1 text-sm text-slate-300">{children}</div>
    </div>
  );
}

