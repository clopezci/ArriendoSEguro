"use client";

import { CreditHistoryGuidanceBlock } from "@/components/contracts/credit-history-guidance-block";
import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import {
  formatColombianNotificationAddress,
  parseNotificationAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, tenantSchema, updateDraft } from "@/features/contracts/wizard-state";
import { sanitizePartyFromForm, PARTY_FIELD_LABELS } from "@/features/contracts/party-sanitize";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function TenantStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-700">Cargando…</p>;
  }

  function onSubmit(formData: FormData) {
    setErrors([]);
    const addrParsed = parseNotificationAddressFromForm(formData);
    if (!addrParsed.success) {
      setErrors(humanizeZodIssues(addrParsed.error.issues));
      return;
    }
    const notificationAddress = formatColombianNotificationAddress(addrParsed.data);
    const sanitized = sanitizePartyFromForm(formData, { notificationAddress });
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

    const { truthfulnessOath, ...tenantData } = parsed.data;
    updateDraft(id, (d) =>
      appendAudit(
        {
          ...d,
          tenant: {
            ...tenantData,
            notificationAddressParts: addrParsed.data,
            truthfulnessOathAccepted: Boolean(truthfulnessOath),
          },
          landlordCreditHistoryAttestation: {
            ...d.landlordCreditHistoryAttestation,
            tenantVerified,
          },
          status: "data_in_progress",
        },
        "tenant_data_saved",
        {
          truthfulnessOathAccepted: Boolean(truthfulnessOath),
          tenantCreditHistoryVerified: tenantVerified,
        },
      ),
    );
    router.push(`/dashboard/contracts/${id}/codebtor`);
  }

  return (
    <WizardShell
      title="Datos del arrendatario (inquilino)"
      currentStep={4}
      contractId={id}
    >
      <form
        id="wizard-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <PartyDataFields
          party={draft.tenant}
          legacyFreeTextAddressMessage={
            !!draft.tenant.notificationAddress && !draft.tenant.notificationAddressParts
          }
          oathId="tenant_truthfulness_oath"
          contractDraftId={id}
        />
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
      <StepNav
        backHref={`/dashboard/contracts/${id}/landlord`}
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/codebtor`}
      />
    </WizardShell>
  );
}
