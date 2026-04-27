"use client";

import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import {
  formatColombianNotificationAddress,
  parseNotificationAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, tenantSchema, updateDraft } from "@/features/contracts/wizard-state";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function TenantStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [error, setError] = useState("");

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-300">Cargando…</p>;

  function onSubmit(formData: FormData) {
    const addrParsed = parseNotificationAddressFromForm(formData);
    if (!addrParsed.success) {
      setError(addrParsed.error.issues[0]?.message ?? "Revisá la dirección de notificación.");
      return;
    }
    const notificationAddress = formatColombianNotificationAddress(addrParsed.data);

    const parsed = tenantSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      city: String(formData.get("city") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notificationAddress,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos del arrendatario.");
      return;
    }

    updateDraft(id, (d) =>
      appendAudit(
        {
          ...d,
          tenant: {
            ...parsed.data,
            notificationAddressParts: addrParsed.data,
          },
          status: "data_in_progress",
        },
        "tenant_data_saved",
      ),
    );
    router.push(`/dashboard/contracts/${id}/codebtor`);
  }

  return (
    <WizardShell title="Datos del arrendatario" currentStep={3} contractId={id}>
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
        />
        {error && <p className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
      </form>
      <StepNav
        backHref={`/dashboard/contracts/${id}/landlord`}
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/codebtor`}
      />
    </WizardShell>
  );
}
