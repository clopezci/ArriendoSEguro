"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
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
    const parsed = landlordSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      city: String(formData.get("city") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notificationAddress: String(formData.get("notificationAddress") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos del arrendador.");
      return;
    }
    updateDraft(id, (d) =>
      appendAudit(
        { ...d, landlord: parsed.data, status: "data_in_progress" },
        "landlord_data_saved",
      ),
    );
    router.push(`/dashboard/contracts/${id}/tenant`);
  }

  return (
    <WizardShell title="Datos del arrendador" currentStep={2} contractId={id}>
      <form id="wizard-form" action={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <Input name="fullName" label="Nombre completo" defaultValue={draft.landlord.fullName} />
        <Input name="documentType" label="Tipo de documento" defaultValue={draft.landlord.documentType} />
        <Input name="documentNumber" label="Número de documento" defaultValue={draft.landlord.documentNumber} />
        <Input name="city" label="Ciudad" defaultValue={draft.landlord.city} />
        <Input name="email" label="Correo" type="email" defaultValue={draft.landlord.email} />
        <Input name="phone" label="Teléfono" defaultValue={draft.landlord.phone} />
        <div className="sm:col-span-2">
          <Input
            name="notificationAddress"
            label="Dirección de notificación"
            defaultValue={draft.landlord.notificationAddress}
          />
        </div>
        {error && <p className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
      </form>
      <StepNav nextHref={`/dashboard/contracts/${id}/tenant`} />
    </WizardShell>
  );
}

function Input({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        type={type}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
      />
    </label>
  );
}

