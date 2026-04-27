"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, termsSchema, updateDraft } from "@/features/contracts/wizard-state";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function TermsStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [error, setError] = useState("");

  if (state !== "ready" || !draft) return <p className="text-sm text-slate-300">Cargando…</p>;

  function onSubmit(formData: FormData) {
    const parsed = termsSchema.safeParse({
      monthlyRent: Number(formData.get("monthlyRent") ?? 0),
      monthlyRentText: String(formData.get("monthlyRentText") ?? ""),
      paymentDueDay: Number(formData.get("paymentDueDay") ?? 1),
      paymentMethod: String(formData.get("paymentMethod") ?? ""),
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      termMonths: Number(formData.get("termMonths") ?? 0),
      latePaymentMonthsThreshold: Number(formData.get("latePaymentMonthsThreshold") ?? 2),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los términos.");
      return;
    }
    updateDraft(id, (d) =>
      appendAudit({ ...d, lease: parsed.data }, "lease_terms_saved"),
    );
    router.push(`/dashboard/contracts/${id}/utilities`);
  }

  return (
    <WizardShell title="Términos del arriendo" currentStep={6} contractId={id}>
      <form
        id="wizard-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <Input name="monthlyRent" label="Canon mensual" type="number" defaultValue={String(draft.lease.monthlyRent ?? "")} />
        <Input
          name="monthlyRentText"
          label="Canon mensual en letras"
          defaultValue={draft.lease.monthlyRentText}
        />
        <Input name="paymentDueDay" label="Día de pago (1-31)" type="number" defaultValue={String(draft.lease.paymentDueDay ?? 1)} />
        <label className="text-sm">
          <span className="mb-1 block text-slate-300">Método de pago</span>
          <select
            name="paymentMethod"
            defaultValue={draft.lease.paymentMethod ?? "transferencia bancaria"}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            <option value="transferencia bancaria">transferencia bancaria</option>
            <option value="efectivo con constancia">efectivo con constancia</option>
            <option value="otro medio acordado">otro medio acordado</option>
          </select>
        </label>
        <Input name="startDate" label="Fecha de inicio" type="date" defaultValue={draft.lease.startDate} />
        <Input name="endDate" label="Fecha de fin" type="date" defaultValue={draft.lease.endDate} />
        <Input name="termMonths" label="Duración (meses)" type="number" defaultValue={String(draft.lease.termMonths ?? "")} />
        <Input
          name="latePaymentMonthsThreshold"
          label="Meses de mora para umbral"
          type="number"
          defaultValue={String(draft.lease.latePaymentMonthsThreshold ?? 2)}
        />
        {error && <p className="sm:col-span-2 text-sm text-rose-300">{error}</p>}
      </form>
      <StepNav
        backHref={`/dashboard/contracts/${id}/property`}
        backLabel="Anterior"
        nextHref={`/dashboard/contracts/${id}/utilities`}
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

