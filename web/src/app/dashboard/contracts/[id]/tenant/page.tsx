"use client";

import { CreditHistoryGuidanceBlock } from "@/components/contracts/credit-history-guidance-block";
import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { PartyInvitePanel } from "@/components/contracts/party-invite-panel";
import { IncomeSuggestion, incomeBelowRent } from "@/components/contracts/income-suggestion";
import { PartySupportsPanel } from "@/components/contracts/codebtor-supports-panel";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { flashSaved } from "@/components/contracts/save-flash";
import { appendAudit, tenantSchema, updateDraft } from "@/features/contracts/wizard-state";
import { sanitizePartyFromForm, PARTY_FIELD_LABELS } from "@/features/contracts/party-sanitize";
import type { PartyDraft } from "@/features/contracts/draft-types";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TENANT_INCOME_DOC_TYPES = [
  { value: "carta_laboral", label: "Carta laboral / certificación de ingresos (empleado)" },
  { value: "colilla", label: "Colillas / desprendibles de pago (empleado)" },
  { value: "extracto", label: "Extractos bancarios (independiente / comerciante)" },
  { value: "declaracion_renta", label: "Declaración de renta" },
  { value: "estado_cuenta", label: "Estado de cuenta / ingresos independientes" },
  { value: "rut", label: "RUT / matrícula mercantil (comerciante)" },
  { value: "otro", label: "Otro soporte de ingresos" },
] as const;

export default function TenantStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [party, setParty] = useState<PartyDraft>(draft?.tenant ?? {});
  const [formKey, setFormKey] = useState(0);
  const [income, setIncome] = useState<number>(0);

  useEffect(() => {
    if (draft?.tenant) setParty(draft.tenant);
  }, [draft?.tenant]);

  useEffect(() => {
    if (draft?.tenantMonthlyIncome != null) setIncome(Number(draft.tenantMonthlyIncome) || 0);
  }, [draft?.tenantMonthlyIncome]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-700">Cargando…</p>;
  }

  function importParty(p: PartyDraft) {
    // Si el titular aceptó por el enlace (con evidencia), conservamos su
    // atestación y NO reseteamos el juramento: la evidencia legal es la suya.
    const attested = Boolean(p.inviteAttestation);
    const next: PartyDraft = { ...p, truthfulnessOathAccepted: attested };
    setParty(next);
    updateDraft(id, (d) => ({ ...d, tenant: next }));
    setFormKey((k) => k + 1);
  }

  function onSubmit(formData: FormData) {
    setErrors([]);
    // Datos mínimos: la dirección de notificación de las personas ya no se pide.
    const sanitized = sanitizePartyFromForm(formData, { notificationAddress: "" });
    const parsed = tenantSchema.safeParse(sanitized);

    if (!parsed.success) {
      setErrors(humanizeZodIssues(parsed.error.issues, PARTY_FIELD_LABELS));
      return;
    }

    const rawVerify = formData.get("tenantCreditHistoryVerified");
    if (rawVerify !== "yes" && rawVerify !== "no") {
      setErrors([
        "Indica si verificaste o no el historial crediticio del arrendatario (inquilino), según la orientación anterior. Es obligatorio elegir Sí o No.",
      ]);
      return;
    }
    const tenantVerified = rawVerify as "yes" | "no";

    const incomeVal = Number(formData.get("tenantMonthlyIncome")) || 0;
    const rentRef = Number(draft?.property?.monthlyRentProposed ?? draft?.lease?.monthlyRent ?? 0);
    if (incomeBelowRent(rentRef, incomeVal)) {
      setErrors([
        "El ingreso del inquilino es inferior al valor del arriendo. Revisa el valor: no tendría cómo pagar el canon.",
      ]);
      return;
    }
    const tenantIncomeDocs = TENANT_INCOME_DOC_TYPES.map((t) => t.value).filter(
      (v) => formData.get(`tenantIncomeDoc_${v}`) === "on",
    );
    const { truthfulnessOath: _ignoredOath, ...tenantData } = parsed.data;
    // El juramento del INQUILINO es del titular: solo cuenta si el propio inquilino
    // lo aceptó por su enlace (self attestation). Si el dueño ingresó los datos, el
    // dueño NO jura por él: queda PENDIENTE y se captura cuando el inquilino firma.
    const titularOathAccepted = party.inviteAttestation
      ? Boolean(party.inviteAttestation.truthfulnessOathAccepted)
      : false;
    updateDraft(id, (d) =>
      appendAudit(
        {
          ...d,
          tenantMonthlyIncome: incomeVal > 0 ? incomeVal : undefined,
          tenantIncomeDocs: tenantIncomeDocs.length > 0 ? tenantIncomeDocs : undefined,
          tenant: {
            ...tenantData,
            truthfulnessOathAccepted: titularOathAccepted,
            // Conservamos la evidencia del titular (si completó por el enlace).
            inviteAttestation: party.inviteAttestation ?? d.tenant?.inviteAttestation,
          },
          landlordCreditHistoryAttestation: {
            ...d.landlordCreditHistoryAttestation,
            tenantVerified,
          },
          status: "data_in_progress",
        },
        "tenant_data_saved",
        {
          truthfulnessOathAccepted: titularOathAccepted,
          tenantCreditHistoryVerified: tenantVerified,
        },
      ),
    );
    flashSaved(() => router.push(`/dashboard/contracts/${id}/codebtor`));
  }

  return (
    <WizardShell
      title="Datos del arrendatario (inquilino)"
      currentStep={4}
      contractId={id}
    >
      <PartyInvitePanel
        contractDraftId={id}
        role="tenant"
        roleLabel="Inquilino"
        inviterName={draft.landlord?.fullName ?? ""}
        onImport={importParty}
      />
      <form
        id="wizard-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <PartyDataFields
          key={formKey}
          party={party}
          oathId="tenant_truthfulness_oath"
          contractDraftId={id}
          thirdPartyAuthorization
          attestation={party.inviteAttestation ?? null}
        />
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-700">Ingreso mensual aprox. del inquilino (COP) — opcional</span>
          <input
            name="tenantMonthlyIncome"
            type="number"
            inputMode="numeric"
            defaultValue={draft.tenantMonthlyIncome ? String(draft.tenantMonthlyIncome) : ""}
            onChange={(e) => setIncome(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
            placeholder="Ej. 5000000"
          />
          <IncomeSuggestion
            rentReference={Number(draft.property?.monthlyRentProposed ?? draft.lease?.monthlyRent ?? 0)}
            income={income}
            who="el inquilino"
          />
        </label>

        <fieldset className="sm:col-span-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
          <legend className="px-1 text-xs font-semibold text-violet-800">
            Documentos de ingresos que aportará el inquilino (opcional)
          </legend>
          <p className="mb-2 text-[11px] text-slate-600">
            Marca los que aplican según sea empleado, independiente o comerciante. Los archivos como tal se cargan en la
            sección de documentos del expediente, tras guardar el contrato.
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            {TENANT_INCOME_DOC_TYPES.map((t) => (
              <label key={t.value} className="flex items-start gap-2 text-xs text-slate-800">
                <input
                  type="checkbox"
                  name={`tenantIncomeDoc_${t.value}`}
                  defaultChecked={draft.tenantIncomeDocs?.includes(t.value) ?? false}
                  className="mt-0.5 h-4 w-4 accent-violet-500"
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <CreditHistoryGuidanceBlock
          variant="tenant"
          verificationName="tenantCreditHistoryVerified"
          defaultVerified={draft.landlordCreditHistoryAttestation?.tenantVerified}
        />
        {errors.length > 0 && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-lg border border-rose-300 bg-rose-100/60 p-3 text-sm text-rose-800"
          >
            <p className="font-semibold">Revisa estos campos antes de continuar:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      <div className="mt-4">
        <PartySupportsPanel contractId={id} variant="wizard" party="tenant" />
      </div>

      <StepNav
        backHref={`/dashboard/contracts/${id}/property`}
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/codebtor`}
      />
    </WizardShell>
  );
}
