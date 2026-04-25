"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
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
    const parsed = tenantSchema.safeParse({
      fullName: String(formData.get("fullName") ?? ""),
      documentType: String(formData.get("documentType") ?? ""),
      documentNumber: String(formData.get("documentNumber") ?? ""),
      city: String(formData.get("city") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notificationAddress: String(formData.get("notificationAddress") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos del arrendatario.");
      return;
    }
    updateDraft(id, (d) =>
      appendAudit(
        { ...d, tenant: parsed.data, status: "data_in_progress" },
        "tenant_data_saved",
      ),
    );
    router.push(`/dashboard/contracts/${id}/codebtor`);
  }

  return (
    <WizardShell title="Datos del arrendatario" currentStep={3} contractId={id}>
      <form id="wizard-form" action={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <Input name="fullName" label="Nombre completo" defaultValue={draft.tenant.fullName} />
        <Input name="documentType" label="Tipo de documento" defaultValue={draft.tenant.documentType} />
        <Input name="documentNumber" label="Número de documento" defaultValue={draft.tenant.documentNumber} />
        <Input name="city" label="Ciudad" defaultValue={draft.tenant.city} />
        <Input name="email" label="Correo" type="email" defaultValue={draft.tenant.email} />
        <Input name="phone" label="Teléfono" defaultValue={draft.tenant.phone} />
        <div className="sm:col-span-2">
          <Input
            name="notificationAddress"
            label="Dirección de notificación"
            defaultValue={draft.tenant.notificationAddress}
          />
        </div>
        {error && <p className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
      </form>
      <StepNav
        backHref={`/dashboard/contracts/${id}/landlord`}
        nextHref={`/dashboard/contracts/${id}/codebtor`}
      />
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

