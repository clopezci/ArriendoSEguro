"use client";

import { useDraftGuard } from "@/components/contracts/draft-tools";
import { ExpedienteNotesCard } from "@/components/contracts/expediente-notes-card";
import { WizardShell } from "@/components/contracts/wizard-shell";
import type { ContractType } from "@/domain/contracts/types";
import {
  getSpecialClauseLabel,
  SPECIAL_CLAUSE_OTHER_ID,
} from "@/features/contracts/special-clauses";
import { appendAudit, updateDraft } from "@/features/contracts/wizard-state";
import { LegalComplianceSeal } from "@/components/contracts/legal-semaphore";
import { evaluateLegalCompliance } from "@/domain/contracts/legalCompliance";
import { IPC_REFERENCE } from "@/lib/domain/rent-law";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  VIVIENDA_URBANA: "Vivienda urbana (Ley 820 de 2003)",
  VIVIENDA_RURAL: "Vivienda rural",
  HABITACION: "Arrendamiento de habitación",
  COMERCIAL: "Local comercial",
  RURAL_PRODUCTIVO: "Predio rural productivo",
};

export default function ReviewStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-700">Cargando…</p>;

  const cap = Number(draft.property.legalRentCap ?? 0);
  const rent = Number(draft.lease.monthlyRent ?? draft.property.monthlyRentProposed ?? 0);
  const valueUnknown = Boolean(draft.property.commercialValueUnknown);

  const contractType = draft.contractType ?? "VIVIENDA_URBANA";
  const contractTypeLabel =
    CONTRACT_TYPE_LABEL[contractType] ?? CONTRACT_TYPE_LABEL.VIVIENDA_URBANA;

  const complianceChecks = evaluateLegalCompliance({
    property: {
      commercialValue: Number(draft.property.commercialValue ?? 0),
      legalRentCap: cap,
      monthlyRentProposed: Number(draft.property.monthlyRentProposed ?? 0),
      commercialValueUnknown: valueUnknown,
    },
    lease: {
      monthlyRent: rent,
      latePaymentMonthsThreshold: Number(draft.lease.latePaymentMonthsThreshold ?? 0),
    },
    utilityServicesGuarantee: draft.utilityServicesGuarantee,
    ipcPercent: IPC_REFERENCE.percent,
  });

  return (
    <WizardShell title="Resumen previo" currentStep={8} contractId={id}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Tipo de contrato">
          <p className="text-violet-700">{contractTypeLabel}</p>
          <p className="text-xs text-slate-600">
            Si necesitas otra modalidad, deberás crear un nuevo expediente
            cuando esté disponible.
          </p>
        </Card>
        <Card title="Arrendador (dueño del inmueble)">
          <p>{draft.landlord.fullName}</p>
          <p>{draft.landlord.documentType} {draft.landlord.documentNumber}</p>
          <p>{draft.landlord.email}</p>
        </Card>
        <Card title="Arrendatario (inquilino)">
          <p>{draft.tenant.fullName}</p>
          <p>{draft.tenant.documentType} {draft.tenant.documentNumber}</p>
          <p>{draft.tenant.email}</p>
        </Card>
        <Card title="Codeudor(es)">
          {draft.hasSolidaryCoDebtor ? (
            <>
              <p>
                <strong>Codeudor 1:</strong> {draft.solidaryCoDebtor.fullName} (
                {draft.solidaryCoDebtor.documentType} {draft.solidaryCoDebtor.documentNumber})
              </p>
              {(draft.solidaryCoDebtors ?? []).map((c, i) => (
                <p key={`${c.documentNumber}-${i}`}>
                  <strong>Codeudor {i + 2}:</strong> {c.fullName} ({c.documentType} {c.documentNumber})
                </p>
              ))}
            </>
          ) : (
            <p>Sin codeudor solidario.</p>
          )}
        </Card>
        <Card title="Inmueble y canon">
          <p>{draft.property.address}</p>
          <p>Canon propuesto: ${rent.toLocaleString("es-CO")}</p>
          {valueUnknown ? (
            <p className="text-amber-800">
              Valor comercial no informado — el arrendador (dueño) asumió la
              responsabilidad expresa de no superar el 1% legal.
            </p>
          ) : (
            <p>Canon máximo estimado (1%): ${cap.toLocaleString("es-CO")}</p>
          )}
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
        <Card title="Garantía de servicios públicos (Art. 15)">
          {draft.utilityServicesGuarantee?.enabled && draft.utilityServicesGuarantee.acceptedAt ? (
            <>
              <p>
                Valor pactado:{" "}
                <strong>${(draft.utilityServicesGuarantee.agreedAmountCop ?? 0).toLocaleString("es-CO")}</strong>
              </p>
              <p className="text-xs text-slate-600">
                Máximo legal: ${(draft.utilityServicesGuarantee.maxAllowedCop ?? 0).toLocaleString("es-CO")} (suma de
                los 2 últimos períodos). Aceptada el {draft.utilityServicesGuarantee.acceptedAt} con captura de IP.
              </p>
            </>
          ) : (
            <p className="text-slate-600">
              No incluida. Es la única garantía permitida (exclusiva para servicios públicos); puedes activarla en el
              paso de Servicios.
            </p>
          )}
        </Card>
        <Card title="Cláusulas especiales">
          {draft.specialClauses?.enabled &&
          draft.specialClauses.selected.length > 0 ? (
            <>
              <ul className="list-disc space-y-1 pl-4">
                {draft.specialClauses.selected.map((clauseId) => (
                  <li key={clauseId}>{getSpecialClauseLabel(clauseId)}</li>
                ))}
              </ul>
              {draft.specialClauses.selected.includes(
                SPECIAL_CLAUSE_OTHER_ID,
              ) &&
                draft.specialClauses.freeText && (
                  <p className="mt-2 rounded border border-slate-300 bg-slate-100/60 p-2 text-xs text-slate-700">
                    <span className="font-semibold text-violet-700">
                      Otra:
                    </span>{" "}
                    {draft.specialClauses.freeText}
                  </p>
                )}
              {draft.specialClauses.selected.includes(
                SPECIAL_CLAUSE_OTHER_ID,
              ) ? (
                <p className="mt-2 text-xs text-amber-800">
                  La cláusula libre («Otra») puede tener un costo adicional;
                  las del catálogo se incluyen sin costo.
                </p>
              ) : (
                <p className="mt-2 text-xs text-emerald-700">
                  Las cláusulas del catálogo se incluyen automáticamente en el
                  contrato sin costo adicional.
                </p>
              )}
            </>
          ) : (
            <p>Sin cláusulas especiales.</p>
          )}
        </Card>
        <Card title="Historial crediticio (declaración del arrendador)">
          {(() => {
            const t = draft.landlordCreditHistoryAttestation?.tenantVerified;
            const c = draft.landlordCreditHistoryAttestation?.codebtorVerified;
            const tenantDone = t === "yes" || t === "no";
            const codeDone =
              !draft.hasSolidaryCoDebtor || c === "yes" || c === "no";
            if (!tenantDone) {
              return (
                <p className="text-slate-600">
                  Falta la declaración sobre el arrendatario (inquilino). Vuelve a ese paso y
                  elige Sí o No antes de generar la vista previa.
                </p>
              );
            }
            if (!codeDone) {
              return (
                <p className="text-amber-800">
                  Falta la declaración sobre el codeudor solidario. Completa el paso del codeudor
                  o indica que no hay codeudor.
                </p>
              );
            }
            const line = (label: string, v: "yes" | "no" | undefined) => (
              <li>
                <strong>{label}:</strong>{" "}
                {v === "yes"
                  ? "Indicas que verificaste o recibiste verificación del historial fuera de esta app."
                  : v === "no"
                    ? "Indicas que no verificaste el historial."
                    : "—"}
              </li>
            );
            return (
              <>
                <ul className="list-disc space-y-1 pl-4 text-slate-700">
                  {line("Arrendatario (inquilino)", t)}
                  {draft.hasSolidaryCoDebtor && line("Codeudor solidario", c)}
                </ul>
                <p className="mt-2 text-xs text-slate-600">
                  No se adjuntaron documentos ni puntajes; solo constancia de lo que marcaste en
                  el asistente.
                </p>
              </>
            );
          })()}
        </Card>
      </div>

      <div className="mt-4">
        <ExpedienteNotesCard
          draftId={id}
          initialNotes={draft.expedienteNotes ?? ""}
        />
      </div>

      {draft.actingAs === "proxy" && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Estás arrendando como <strong>apoderado</strong>. Recuerda subir el <strong>poder autenticado</strong> en{" "}
          <Link href={`/dashboard/contracts/${id}/documentos-propiedad`} className="underline">
            Documentos de propiedad / poder
          </Link>{" "}
          (evidencias del expediente).
        </div>
      )}

      <div className="mt-4">
        <LegalComplianceSeal checks={complianceChecks} />
        <p className="mt-2 text-xs text-slate-500">
          ArriendoSeguro no recauda dinero ni garantiza pagos; el respaldo es documental y de evidencia.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-violet-300 bg-violet-50/40 p-4">
        <p className="text-sm font-semibold text-violet-900">¿Quieres configurar adicionales? (opcional)</p>
        <p className="mt-1 text-xs text-slate-600">
          Codeudores, garantía de servicios, cláusulas especiales, método de pago y recordatorios, notaría y documentos
          de propiedad. Todo a tu elección.
        </p>
        <Link
          href={`/dashboard/contracts/${id}/adicionales`}
          className="mt-2 inline-flex rounded-lg border border-violet-500 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
        >
          Abrir Centro de adicionales →
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        <div className="rounded-xl border border-violet-400 bg-violet-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Siguiente paso</p>
          <p className="mt-1 text-sm text-slate-700">
            Genera la vista previa para revisar tu contrato y, desde ahí, <strong>guardarlo, firmarlo y descargar el
            PDF</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              updateDraft(id, (d) => appendAudit(d, "contract_draft_saved"));
              router.push(`/dashboard/contracts/${id}/preview`);
            }}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(139,92,246,0.35)] hover:bg-violet-500"
          >
            Continuar a la vista previa →
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/dashboard/contracts/${id}/landlord`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:border-violet-500"
          >
            Editar datos
          </Link>
          <button
            type="button"
            onClick={() => {
              updateDraft(id, (d) => appendAudit(d, "contract_draft_saved"));
              alert("Borrador guardado.");
            }}
            className="rounded-lg border border-violet-500 px-4 py-2 text-sm font-medium text-violet-700"
          >
            Guardar borrador
          </button>
        </div>
      </div>
    </WizardShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white/95 p-4">
      <h3 className="mb-2 text-sm font-semibold text-violet-700">{title}</h3>
      <div className="space-y-1 text-sm text-slate-700">{children}</div>
    </div>
  );
}

