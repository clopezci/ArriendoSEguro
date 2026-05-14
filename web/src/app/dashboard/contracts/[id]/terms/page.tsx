"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { appendAudit, termsSchema, updateDraft } from "@/features/contracts/wizard-state";
import { sanitizeFreeText } from "@/lib/text/sanitize";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

/** Mapa de campos a etiquetas amigables en español para los errores. */
const TERMS_FIELD_LABELS: Record<string, string> = {
  monthlyRent: "Canon mensual",
  monthlyRentText: "Canon mensual en letras",
  paymentDueDay: "Día de pago",
  paymentMethod: "Método de pago",
  startDate: "Fecha de inicio del contrato",
  endDate: "Fecha de fin del contrato",
  termMonths: "Duración del contrato",
  latePaymentMonthsThreshold: "Umbral de mora",
};

export default function TermsStepPage() {
  const id = String(useParams<{ id: string }>().id);
  const { draft, state } = useDraftGuard(id);
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-700">Cargando…</p>;
  }

  function onSubmit(formData: FormData) {
    setErrors([]);
    const parsed = termsSchema.safeParse({
      monthlyRent: Number(formData.get("monthlyRent") ?? 0),
      monthlyRentText: sanitizeFreeText(String(formData.get("monthlyRentText") ?? "")),
      paymentDueDay: Number(formData.get("paymentDueDay") ?? 1),
      paymentMethod: String(formData.get("paymentMethod") ?? ""),
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      termMonths: Number(formData.get("termMonths") ?? 0),
      latePaymentMonthsThreshold: Number(
        formData.get("latePaymentMonthsThreshold") ?? 2,
      ),
    });
    if (!parsed.success) {
      setErrors(humanizeZodIssues(parsed.error.issues, TERMS_FIELD_LABELS));
      return;
    }
    updateDraft(id, (d) => appendAudit({ ...d, lease: parsed.data }, "lease_terms_saved"));
    router.push(`/dashboard/contracts/${id}/utilities`);
  }

  return (
    <WizardShell title="Términos del arriendo" currentStep={7} contractId={id}>
      <form
        id="wizard-form"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
      >
        <Input
          name="monthlyRent"
          label="Canon mensual (COP)"
          type="number"
          defaultValue={String(draft.lease.monthlyRent ?? "")}
          hint="Valor mensual del arriendo en pesos colombianos."
        />
        <Input
          name="monthlyRentText"
          label="Canon mensual en letras"
          defaultValue={draft.lease.monthlyRentText}
          hint="Ejemplo: «un millón quinientos mil pesos»."
        />
        <Input
          name="paymentDueDay"
          label="Día de pago (1 a 31)"
          type="number"
          defaultValue={String(draft.lease.paymentDueDay ?? 1)}
          hint="Día del mes en que se debe pagar el canon."
        />
        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Método de pago</span>
          <select
            name="paymentMethod"
            defaultValue={draft.lease.paymentMethod ?? "transferencia bancaria"}
            className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
          >
            <option value="transferencia bancaria">Transferencia bancaria</option>
            <option value="efectivo con constancia">Efectivo con constancia</option>
            <option value="otro medio acordado">Otro medio acordado</option>
          </select>
          <span className="mt-1 block text-xs text-slate-600">
            Cómo se transferirá el dinero del canon cada mes.
          </span>
        </label>
        <Input
          name="startDate"
          label="Fecha de inicio del contrato"
          type="date"
          defaultValue={draft.lease.startDate}
          hint="Día desde el cual el contrato entra en vigor."
        />
        <Input
          name="endDate"
          label="Fecha de fin del contrato"
          type="date"
          defaultValue={draft.lease.endDate}
          hint="Día en que termina la vigencia inicial del contrato."
        />
        <Input
          name="termMonths"
          label="Duración del contrato (meses)"
          type="number"
          defaultValue={String(draft.lease.termMonths ?? "")}
          hint="Cantidad de meses entre la fecha de inicio y la de fin."
        />
        <Input
          name="latePaymentMonthsThreshold"
          label="Umbral de mora (meses)"
          type="number"
          defaultValue={String(draft.lease.latePaymentMonthsThreshold ?? 2)}
          hint="Meses de canon impago acumulados a partir de los cuales el arrendador (dueño) puede iniciar gestiones de cobro o terminación del contrato. La ley colombiana exige al menos 2 meses; puedes pactar más, nunca menos."
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
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
      />
      {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
    </label>
  );
}
