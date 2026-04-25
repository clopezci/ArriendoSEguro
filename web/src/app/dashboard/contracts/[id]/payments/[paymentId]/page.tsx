"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type PaymentDetail = {
  id: string;
  periodLabel: string;
  dueDate: string;
  paidDate?: string;
  amountDue: number;
  amountPaid: number;
  paymentMethod: string;
  notes?: string;
  paymentStatus: string;
  reportedByUserId?: string;
  reportedByEmail?: string;
  reportedByRole?: string;
  reportedAt?: string;
  supportFileUrl?: string;
  supportFileName?: string;
  supportValidationStatus?: "pending" | "valid" | "invalid";
  updatedAt?: string;
};
type PaymentHistoryItem = { event?: string; at?: string; actor?: string };

export default function PaymentDetailPage() {
  const params = useParams<{ id: string; paymentId: string }>();
  const contractId = String(params.id);
  const paymentId = String(params.paymentId);
  const { state } = useDraftGuard(contractId);
  const { user } = useAuth();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/payments/detail?paymentLogId=${encodeURIComponent(paymentId)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPayment(data.payment as PaymentDetail);
        setHistory((data.history ?? []) as PaymentHistoryItem[]);
      }
    };
    void run();
  }, [paymentId]);

  if (state !== "ready") return <p className="text-sm text-slate-300">Cargando...</p>;
  if (!payment) return <p className="text-sm text-slate-300">Cargando pago...</p>;
  const paymentData = payment;

  async function saveChanges() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payments/update", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user ?? null)) },
        body: JSON.stringify({
          paymentLogId: paymentData.id,
          periodLabel: paymentData.periodLabel,
          dueDate: paymentData.dueDate,
          paidDate: paymentData.paidDate || undefined,
          amountDue: Number(paymentData.amountDue),
          amountPaid: Number(paymentData.amountPaid),
          paymentMethod: paymentData.paymentMethod,
          notes: paymentData.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo actualizar.");
      router.push(`/dashboard/contracts/${contractId}/payments`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function markDisputed() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payments/mark-disputed", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user ?? null)) },
        body: JSON.stringify({ paymentLogId: paymentData.id, reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo marcar disputa.");
      router.push(`/dashboard/contracts/${contractId}/payments`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al marcar disputa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WizardShell title="Detalle de pago" currentStep={9} contractId={contractId}>
      {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Periodo" value={paymentData.periodLabel} onChange={(v) => setPayment((prev) => (prev ? { ...prev, periodLabel: v } : prev))} />
        <Input label="Vencimiento" value={paymentData.dueDate} onChange={(v) => setPayment((prev) => (prev ? { ...prev, dueDate: v } : prev))} />
        <Input label="Fecha pagada" value={paymentData.paidDate ?? ""} onChange={(v) => setPayment((prev) => (prev ? { ...prev, paidDate: v } : prev))} />
        <Input label="Valor esperado" value={String(paymentData.amountDue)} onChange={(v) => setPayment((prev) => (prev ? { ...prev, amountDue: Number(v || 0) } : prev))} type="number" />
        <Input label="Valor pagado" value={String(paymentData.amountPaid)} onChange={(v) => setPayment((prev) => (prev ? { ...prev, amountPaid: Number(v || 0) } : prev))} type="number" />
        <label className="text-xs text-slate-300">
          Método
          <select className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm" value={paymentData.paymentMethod} onChange={(e) => setPayment((prev) => (prev ? { ...prev, paymentMethod: e.target.value } : prev))}>
            <option>transferencia bancaria</option>
            <option>efectivo con constancia</option>
            <option>consignación</option>
            <option>otro</option>
          </select>
        </label>
      </div>
      <label className="mt-2 block text-xs text-slate-300">
        Observaciones
        <textarea className="mt-1 min-h-24 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm" value={paymentData.notes ?? ""} onChange={(e) => setPayment((prev) => (prev ? { ...prev, notes: e.target.value } : prev))} />
      </label>
      <p className="mt-2 text-xs text-slate-400">Estado actual: {paymentData.paymentStatus}</p>
      <div className="mt-2 rounded border border-slate-700 p-3 text-xs text-slate-300">
        <p>Reportado por (uid): {paymentData.reportedByUserId ?? "-"}</p>
        <p>Correo del reporte: {paymentData.reportedByEmail ?? "-"}</p>
        <p>Rol del reporte: {paymentData.reportedByRole ?? "-"}</p>
        <p>Fecha reporte: {paymentData.reportedAt ?? paymentData.updatedAt ?? "-"}</p>
        <p>Soporte adjunto: {paymentData.supportFileName ?? "-"}</p>
        <p>Estado del soporte: {paymentData.supportValidationStatus ?? "pending"}</p>
        {paymentData.supportFileUrl ? (
          <a className="text-violet-300" href={paymentData.supportFileUrl} target="_blank" rel="noreferrer">
            Ver soporte
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={saveChanges} disabled={saving} className="rounded bg-violet-600 px-4 py-2 text-sm text-white">{saving ? "Guardando..." : "Guardar cambios"}</button>
      </div>

      <div className="mt-5 rounded border border-amber-700 p-3">
        <p className="text-xs text-amber-200">Marcar como disputado</p>
        <input className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de disputa" />
        <button type="button" onClick={markDisputed} disabled={saving || reason.trim().length < 3} className="mt-2 rounded border border-amber-500 px-3 py-2 text-xs text-amber-200">Marcar en revisión</button>
      </div>
      <div className="mt-5 rounded border border-slate-700 p-3">
        <p className="text-xs text-slate-300">Historial de cambios</p>
        <ul className="mt-2 space-y-1 text-xs text-slate-400">
          {history.map((item, idx) => (
            <li key={`${item.event ?? "evt"}-${idx}`}>
              {item.event ?? "evento"} - {item.at ?? "-"} - {item.actor ?? "sistema"}
            </li>
          ))}
          {history.length === 0 ? <li>Sin historial.</li> : null}
        </ul>
      </div>
    </WizardShell>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="text-xs text-slate-300">
      {label}
      <input type={type} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

