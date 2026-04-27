"use client";

import { PartyDataFields } from "@/components/contracts/party-data-fields";
import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import {
  formatColombianNotificationAddress,
  parseNotificationAddressFromForm,
} from "@/domain/colombia/structured-address";
import { appendAudit, landlordSchema, updateDraft } from "@/features/contracts/wizard-state";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function LandlordStepPage() {
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

    const parsed = landlordSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      city: String(formData.get("city") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notificationAddress,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos del arrendador.");
      return;
    }

    updateDraft(id, (d) =>
      appendAudit(
        {
          ...d,
          landlord: {
            ...parsed.data,
            notificationAddressParts: addrParsed.data,
          },
          status: "data_in_progress",
        },
        "landlord_data_saved",
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
        {error && <p className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
      </form>
      <StepNav
        backHref="/dashboard/leases"
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/tenant`}
      />
    </WizardShell>
  );
}
