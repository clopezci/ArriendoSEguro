"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, updateDraft, utilitiesSchema } from "@/features/contracts/wizard-state";
import { sanitizeFreeText } from "@/lib/text/sanitize";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const UTILITIES_FIELD_LABELS: Record<string, string> = {
  responsibleParty: "Responsable de los servicios públicos",
  details: "Detalle de servicios públicos",
  adminFeesDetails: "Detalle de administración y expensas",
};

export default function UtilitiesStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-300">Cargando…</p>;
  }

  function onSubmit(formData: FormData) {
    setErrors([]);
    const parsed = utilitiesSchema.safeParse({
      responsibleParty: String(formData.get("responsibleParty") ?? ""),
      details: sanitizeFreeText(String(formData.get("details") ?? "")),
      adminFeesDetails: sanitizeFreeText(String(formData.get("adminFeesDetails") ?? "")),
    });
    if (!parsed.success) {
      setErrors(humanizeZodIssues(parsed.error.issues, UTILITIES_FIELD_LABELS));
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
      <form
        id="wizard-form"
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
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
        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100"
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
        backHref={`/dashboard/contracts/${id}/terms`}
        backLabel="Anterior"
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

