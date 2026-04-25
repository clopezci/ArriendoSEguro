"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";

export default function NewPaymentPage() {
  const id = String(useParams<{ id: string }>().id);
  const contractVersionId = useSearchParams().get("contractVersionId") ?? "";
  const router = useRouter();
  const { state } = useDraftGuard(id);
  const [periodLabel, setPeriodLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [amountDue, setAmountDue] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("transferencia bancaria");
  const [supportFileUrl, setSupportFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (state !== "ready") return <p className="text-sm text-slate-300">Cargando...</p>;

  async function onSubmit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leaseProcessId: id,
          contractId: id,
          contractVersionId,
          periodLabel,
          dueDate,
          paidDate: paidDate || undefined,
          amountDue: Number(amountDue),
          amountPaid: Number(amountPaid),
          paymentMethod,
          supportFileUrl: supportFileUrl || undefined,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo registrar pago.");
      router.push(`/dashboard/contracts/${id}/payments`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al registrar pago.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardShell title="Registrar pago" currentStep={9} contractId={id}>
      {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Periodo pagado" value={periodLabel} onChange={setPeriodLabel} placeholder="Mayo 2026" />
        <Input label="Fecha de vencimiento" value={dueDate} onChange={setDueDate} placeholder="YYYY-MM-DD" />
        <Input label="Fecha de pago" value={paidDate} onChange={setPaidDate} placeholder="YYYY-MM-DD (opcional)" />
        <Input label="Valor esperado" value={amountDue} onChange={setAmountDue} placeholder="1000000" type="number" />
        <Input label="Valor pagado" value={amountPaid} onChange={setAmountPaid} placeholder="1000000" type="number" />
        <label className="text-xs text-slate-300">
          Método de pago
          <select className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option>transferencia bancaria</option>
            <option>efectivo con constancia</option>
            <option>consignación</option>
            <option>otro</option>
          </select>
        </label>
        <Input label="Soporte de pago (URL opcional)" value={supportFileUrl} onChange={setSupportFileUrl} placeholder="https://..." />
      </div>
      <label className="mt-3 block text-xs text-slate-300">
        Observaciones
        <textarea className="mt-1 min-h-24 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onSubmit} disabled={saving} className="rounded bg-violet-600 px-4 py-2 text-sm text-white">{saving ? "Guardando..." : "Guardar pago"}</button>
      </div>
    </WizardShell>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="text-xs text-slate-300">
      {label}
      <input
        type={type}
        className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

