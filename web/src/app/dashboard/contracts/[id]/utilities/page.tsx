"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, updateDraft, utilitiesSchema } from "@/features/contracts/wizard-state";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function UtilitiesStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [error, setError] = useState("");

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-300">Cargando…</p>;

  function onSubmit(formData: FormData) {
    const parsed = utilitiesSchema.safeParse({
      responsibleParty: String(formData.get("responsibleParty") ?? ""),
      details: String(formData.get("details") ?? ""),
      adminFeesDetails: String(formData.get("adminFeesDetails") ?? ""),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa servicios públicos.");
      return;
    }
    updateDraft(id, (d) =>
      appendAudit(
        { ...d, utilities: parsed.data, status: "ready_for_preview" },
        "utilities_saved",
      ),
    );
    router.push(`/dashboard/contracts/${id}/review`);
  }

  return (
    <WizardShell title="Servicios públicos y administración" currentStep={7} contractId={id}>
      <form id="wizard-form" action={onSubmit} className="space-y-3">
        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Responsable principal</span>
          <select
            name="responsibleParty"
            defaultValue={draft.utilities.responsibleParty ?? "arrendatario"}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            <option value="arrendatario">arrendatario</option>
            <option value="arrendador">arrendador</option>
            <option value="compartido">compartido</option>
          </select>
        </label>
        <Area
          name="details"
          label="Detalle de servicios públicos"
          defaultValue={draft.utilities.details}
        />
        <Area
          name="adminFeesDetails"
          label="Detalle de administración y expensas"
          defaultValue={draft.utilities.adminFeesDetails}
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </form>
      <StepNav
        backHref={`/dashboard/contracts/${id}/terms`}
        nextHref={`/dashboard/contracts/${id}/review`}
      />
    </WizardShell>
  );
}

function Area({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={4}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
      />
    </label>
  );
}

