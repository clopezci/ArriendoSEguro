"use client";

import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import {
  formatColombianNotificationAddress,
  parseNotificationAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, landlordSchema, updateDraft } from "@/features/contracts/wizard-state";
import { sanitizePartyFromForm, PARTY_FIELD_LABELS } from "@/features/contracts/party-sanitize";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function LandlordStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-300">Cargando…</p>;
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
    const parsed = landlordSchema.safeParse(sanitized);

    if (!parsed.success) {
      setErrors(humanizeZodIssues(parsed.error.issues, PARTY_FIELD_LABELS));
      return;
    }

    const { truthfulnessOath, ...landlordData } = parsed.data;
    updateDraft(id, (d) =>
      appendAudit(
        {
          ...d,
          landlord: {
            ...landlordData,
            notificationAddressParts: addrParsed.data,
            truthfulnessOathAccepted: Boolean(truthfulnessOath),
          },
          status: "data_in_progress",
        },
        "landlord_data_saved",
        { truthfulnessOathAccepted: Boolean(truthfulnessOath) },
      ),
    );
    router.push(`/dashboard/contracts/${id}/tenant`);
  }

  return (
    <WizardShell title="Datos del arrendador" currentStep={2} contractId={id}>
      <form
        id="wizard-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <PartyDataFields
          party={draft.landlord}
          legacyFreeTextAddressMessage={
            !!draft.landlord.notificationAddress && !draft.landlord.notificationAddressParts
          }
        />
        {errors.length > 0 && (
          <div
            role="alert"
            className="sm:col-span-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100"
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
        backHref="/dashboard/leases"
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/tenant`}
      />
    </WizardShell>
  );
}
