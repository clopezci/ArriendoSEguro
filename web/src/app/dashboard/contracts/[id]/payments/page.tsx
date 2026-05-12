"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { PAYMENT_REMINDER_TEXT } from "@/domain/payments/paymentRules";
import { visualPaymentState } from "@/domain/payments/paymentStatus";

type Payment = {
  id: string;
  periodLabel: string;
  dueDate: string;
  paidDate?: string;
  amountDue: number;
  amountPaid: number;
  paymentMethod: string;
  paymentStatus:
    | "pending"
    | "pending_support"
    | "reported_without_support"
    | "reported_paid"
    | "partial"
    | "late"
    | "disputed"
    | "cancelled";
  notes?: string;
};
type ScheduledPayment = { id: string; periodLabel: string; dueDate: string; status: string };

export default function PaymentsPage() {
  const id = String(useParams<{ id: string }>().id);
  const { state } = useDraftGuard(id);
  const { user } = useAuth();
  const [contractVersionId, setContractVersionId] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [canon, setCanon] = useState<number>(0);
  const [paymentDay, setPaymentDay] = useState<number>(1);
  const [error, setError] = useState("");
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);

  useEffect(() => {
    const run = async () => {
      const latest = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`).then((r) => r.json());
      const versionId = latest?.version?.id ?? latest?.contract?.currentVersionId ?? "";
      setContractVersionId(versionId);
      setCanon(Number(latest?.version?.contractPayload?.lease?.monthlyRent ?? 0));
      setPaymentDay(Number(latest?.version?.contractPayload?.lease?.paymentDueDay ?? 1));
      if (!versionId) return;
      const list = await fetch(`/api/payments/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`).then((r) => r.json());
      if (list?.success) setPayments(list.payments ?? []);
      const sch = await fetch(`/api/payments/schedule/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`).then((r) => r.json());
      if (sch?.success) setScheduledPayments(sch.scheduledPayments ?? []);
    };
    void run();
  }, [id]);

  const summary = useMemo(() => {
    const today = Date.now();
    const pending = payments.filter((p) => p.paymentStatus === "pending" || p.paymentStatus === "pending_support" || p.paymentStatus === "reported_without_support").length;
    const partial = payments.filter((p) => p.paymentStatus === "partial").length;
    const disputed = payments.filter((p) => p.paymentStatus === "disputed").length;
    const overdue = payments.filter((p) => !p.paidDate && new Date(p.dueDate).getTime() < today).length;
    const nextDue = scheduledPayments
      .filter((p) => new Date(p.dueDate).getTime() >= today)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
    const overdueSchedule = scheduledPayments.filter((p) => p.status === "late").length;
    const upcomingSchedule = scheduledPayments.filter((p) => new Date(p.dueDate).getTime() >= today).length;
    return {
      pending,
      partial,
      disputed,
      overdue,
      nextDue: nextDue ? `${nextDue.periodLabel} (${nextDue.dueDate})` : "Sin pagos próximos",
      allGood: pending === 0 && partial === 0 && disputed === 0 && overdue === 0,
      overdueSchedule,
      upcomingSchedule,
      calendarState: scheduledPayments.length ? "Generado" : "Sin generar",
    };
  }, [payments, scheduledPayments]);

  if (state !== "ready") return <p className="text-sm text-slate-300">Cargando...</p>;

  async function generateAnnex() {
    setError("");
    if (!contractVersionId) {
      setError("Primero guarda una versión contractual.");
      return;
    }
    const res = await fetch("/api/payments/generate-annex", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await buildAuthHeaders(user ?? null)) },
      body: JSON.stringify({ contractId: id, contractVersionId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setError(data?.errors?.[0]?.message ?? "No se pudo generar anexo.");
      return;
    }
    const list = await fetch(`/api/payments/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(contractVersionId)}`).then((r) => r.json());
    if (list?.success) setPayments(list.payments ?? []);
  }

  return (
    <WizardShell title="Registro de pagos" currentStep={11} contractId={id}>
      <p className="rounded border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">{PAYMENT_REMINDER_TEXT.noCollection}</p>
      <p className="mt-2 rounded border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">{PAYMENT_REMINDER_TEXT.supportHint}</p>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        <Card label="Canon mensual" value={`$${canon.toLocaleString("es-CO")}`} />
        <Card label="Día de pago" value={`${paymentDay}`} />
        <Card label="Próximo pago esperado" value={summary.nextDue} />
      </section>
      <section className="mt-3 grid gap-3 md:grid-cols-5">
        <Card label="Pagos pendientes" value={`${summary.pending}`} />
        <Card label="Pagos vencidos" value={`${summary.overdue}`} />
        <Card label="Pagos parciales" value={`${summary.partial}`} />
        <Card label="Pagos disputados" value={`${summary.disputed}`} />
        <Card label="Estado general" value={summary.allGood ? "Al día" : "Revisar"} />
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/dashboard/contracts/${id}/payment-schedule`} className="rounded border border-sky-500 px-3 py-2 text-sm text-sky-200">Calendario</Link>
        <button type="button" className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200">Pagos registrados</button>
        <button type="button" className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200">Soportes</button>
        <button type="button" className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200">Recordatorios</button>
        <Link href={`/dashboard/contracts/${id}/payments/new?contractVersionId=${encodeURIComponent(contractVersionId)}`} className="rounded bg-violet-600 px-3 py-2 text-sm text-white">Registrar pago</Link>
        <button type="button" onClick={generateAnnex} className="rounded border border-emerald-500 px-3 py-2 text-sm text-emerald-200">Generar anexo de pagos</button>
      </div>
      <section className="mt-3 grid gap-3 md:grid-cols-3">
        <Card label="Próximo vencimiento" value={summary.nextDue} />
        <Card label="Pagos próximos (calendario)" value={`${summary.upcomingSchedule}`} />
        <Card label="Estado calendario" value={`${summary.calendarState} / Vencidos: ${summary.overdueSchedule}`} />
      </section>

      <div className="mt-4 overflow-auto rounded border border-slate-700">
        <table className="min-w-full text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-2 py-1 text-left">Periodo</th>
              <th className="px-2 py-1 text-left">Vencimiento</th>
              <th className="px-2 py-1 text-left">Pagado</th>
              <th className="px-2 py-1 text-left">Esperado</th>
              <th className="px-2 py-1 text-left">Pagado</th>
              <th className="px-2 py-1 text-left">Estado</th>
              <th className="px-2 py-1 text-left">Visual</th>
              <th className="px-2 py-1 text-left">Acción</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-800">
                <td className="px-2 py-1">{p.periodLabel}</td>
                <td className="px-2 py-1">{p.dueDate}</td>
                <td className="px-2 py-1">{p.paidDate ?? "-"}</td>
                <td className="px-2 py-1">{p.amountDue.toLocaleString("es-CO")}</td>
                <td className="px-2 py-1">{p.amountPaid.toLocaleString("es-CO")}</td>
                <td className="px-2 py-1">{humanStatus(p.paymentStatus)}</td>
                <td className="px-2 py-1">{visualPaymentState(p)}</td>
                <td className="px-2 py-1">
                  <Link href={`/dashboard/contracts/${id}/payments/${p.id}`} className="text-violet-300">Ver/Editar</Link>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td className="px-2 py-3 text-slate-400" colSpan={8}>Sin pagos registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </WizardShell>
  );
}

function humanStatus(status: Payment["paymentStatus"]): string {
  if (status === "pending") return "Pendiente";
  if (status === "pending_support" || status === "reported_without_support") return "Pendiente de soporte";
  if (status === "reported_paid") return "Reportado pagado";
  if (status === "partial") return "Parcial";
  if (status === "late") return "Vencido";
  if (status === "disputed") return "En disputa";
  if (status === "cancelled") return "Cancelado";
  return status;
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-700 bg-slate-900/70 p-3">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

