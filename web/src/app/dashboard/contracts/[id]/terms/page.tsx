"use client";

import { StepNav, useDraftGuard } from "@/components/contracts/draft-tools";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { flashSaved } from "@/components/contracts/save-flash";
import { appendAudit, termsSchema, updateDraft } from "@/features/contracts/wizard-state";
import { sanitizeFreeText } from "@/lib/text/sanitize";
import { humanizeZodIssues } from "@/lib/validations/zod-errors-es";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const formatCop = (n: number) => `$${(n || 0).toLocaleString("es-CO")}`;

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
  // Canon en vivo para comparar con el tope legal del 1% (Ley 820, art. 18).
  const [rent, setRent] = useState<number>(0);

  useEffect(() => {
    if (draft?.lease?.monthlyRent != null) setRent(Number(draft.lease.monthlyRent) || 0);
  }, [draft?.lease?.monthlyRent]);

  if (state !== "ready" || !draft) {
    return <p className="text-sm text-slate-700">Cargando…</p>;
  }

  const commercialValue = Number(draft.property?.commercialValue ?? 0);
  const capUnknown = Boolean(draft.property?.commercialValueUnknown);
  const legalCap = commercialValue > 0 ? Math.round(commercialValue * 0.01) : 0;

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
    const renewalReminderEnabled = formData.get("renewalReminderEnabled") === "on";
    updateDraft(id, (d) =>
      appendAudit({ ...d, lease: parsed.data, renewalReminderEnabled }, "lease_terms_saved"),
    );
    flashSaved(() => router.push(`/dashboard/contracts/${id}/utilities`));
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
        <div className="sm:col-span-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-xs leading-relaxed text-slate-700">
          <strong className="text-violet-800">Condiciones del contrato.</strong> Configúralas en orden: valor y tope
          legal · método de pago · fechas y duración · alertas · servicios y anticipo · cláusulas. Al final, al guardar,
          adjuntas los documentos de soporte.
        </div>

        <label className="text-sm">
          <span className="mb-1 block text-slate-700">Canon mensual (COP)</span>
          <input
            name="monthlyRent"
            type="number"
            inputMode="numeric"
            defaultValue={String(draft.lease.monthlyRent ?? "")}
            onChange={(e) => setRent(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-900"
          />
          <span className="mt-1 block text-xs text-slate-600">Valor mensual del arriendo en pesos colombianos.</span>
        </label>

        {(legalCap > 0 || capUnknown) && (
          <div
            className={`sm:col-span-2 rounded-lg border p-3 text-xs leading-relaxed ${
              capUnknown
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : rent > 0 && rent > legalCap
                  ? "border-rose-300 bg-rose-50 text-rose-800"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            {capUnknown ? (
              <>
                Declaraste <strong>no conocer el valor comercial</strong>: el tope del 1% (Ley 820, art. 18) queda bajo tu
                responsabilidad. Mantén el canon en un valor razonable frente al mercado.
              </>
            ) : (
              <>
                Tope legal del canon = 1% del valor comercial declarado ({formatCop(commercialValue)}):{" "}
                <strong>{formatCop(legalCap)}</strong>.
                {rent > 0 &&
                  (rent > legalCap
                    ? " ⚠️ El canon ingresado supera el tope legal. Ajústalo."
                    : " ✓ El canon está dentro del tope.")}
              </>
            )}
          </div>
        )}
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

        {draft.isDemo || draft.accessStatusSnapshot === "paid" ? (
          <label className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-sm text-slate-800">
            <input
              type="checkbox"
              name="renewalReminderEnabled"
              defaultChecked={draft.renewalReminderEnabled ?? true}
              className="mt-0.5 h-4 w-4 accent-violet-600"
            />
            <span>
              Quiero recibir <strong>recordatorios de terminación o renovación</strong> de este contrato (por correo y
              SMS), con anticipación al preaviso legal de 3 meses. Podrás cambiarlo luego en «Alertas» del expediente.
            </span>
          </label>
        ) : (
          <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            <input type="checkbox" disabled aria-disabled="true" className="mt-0.5 h-4 w-4" />
            <span>
              <strong>Recordatorios de terminación o renovación</strong> (por correo y SMS, antes del preaviso legal de
              3 meses).{" "}
              <span className="font-semibold text-violet-700">Disponible en Plan Plus.</span>
            </span>
          </div>
        )}

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
        backHref={`/dashboard/contracts/${id}/codebtor`}
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
