"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type ScheduledPayment = {
  id: string;
  periodNumber: number;
  periodLabel: string;
  dueDate: string;
  expectedAmount: number;
  status: string;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  paymentLogId?: string;
};

export default function PaymentSchedulePage() {
  const id = String(useParams<{ id: string }>().id);
  const { state } = useDraftGuard(id);
  const { user } = useAuth();
  const [contractVersionId, setContractVersionId] = useState("");
  const [schedule, setSchedule] = useState<ScheduledPayment[]>([]);
  const [leaseData, setLeaseData] = useState({ monthlyRent: 0, termMonths: 0, startDate: "", paymentDueDay: 1 });
  const [settings, setSettings] = useState({
    enabled: true,
    defaultDaysBefore: 3,
    tenantEmail: "",
    landlordCopyEnabled: false,
    landlordEmail: "",
    customMessage: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const latest = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`).then((r) => r.json());
    const versionId = latest?.version?.id ?? latest?.contract?.currentVersionId ?? "";
    setContractVersionId(versionId);
    setLeaseData({
      monthlyRent: Number(latest?.version?.contractPayload?.lease?.monthlyRent ?? 0),
      termMonths: Number(latest?.version?.contractPayload?.lease?.termMonths ?? 0),
      startDate: latest?.version?.contractPayload?.lease?.startDate ?? "",
      paymentDueDay: Number(latest?.version?.contractPayload?.lease?.paymentDueDay ?? 1),
    });
    if (!versionId) return;
    const list = await fetch(`/api/payments/schedule/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`).then((r) => r.json());
    if (list?.success) {
      setSchedule((list.scheduledPayments ?? []) as ScheduledPayment[]);
      if (list.reminderSettings) {
        setSettings({
          enabled: Boolean(list.reminderSettings.enabled),
          defaultDaysBefore: Number(list.reminderSettings.defaultDaysBefore ?? 3),
          tenantEmail: String(list.reminderSettings.tenantEmail ?? ""),
          landlordCopyEnabled: Boolean(list.reminderSettings.landlordCopyEnabled),
          landlordEmail: String(list.reminderSettings.landlordEmail ?? ""),
          customMessage: String(list.reminderSettings.customMessage ?? ""),
        });
      }
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const now = Date.now();
    const late = schedule.filter((s) => s.status === "late").length;
    const upcoming = schedule.filter((s) => new Date(s.dueDate).getTime() >= now).length;
    return { late, upcoming };
  }, [schedule]);

  if (state !== "ready") return <p className="text-sm text-slate-700">Cargando...</p>;

  async function generate() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payments/schedule/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leaseProcessId: id,
          contractId: id,
          contractVersionId,
          reminderSettings: settings,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.errors?.[0]?.message ?? "No se pudo generar calendario.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar calendario.");
    } finally {
      setSaving(false);
    }
  }

  async function updateOne(row: ScheduledPayment, patch: Partial<ScheduledPayment>) {
    const res = await fetch("/api/payments/schedule/update-one", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await buildAuthHeaders(user ?? null)) },
      body: JSON.stringify({
        scheduledPaymentId: row.id,
        dueDate: patch.dueDate,
        expectedAmount: patch.expectedAmount,
        reminderEnabled: patch.reminderEnabled,
        reminderDaysBefore: patch.reminderDaysBefore,
        status: patch.status,
      }),
    });
    if (res.ok) await load();
  }

  return (
    <WizardShell title="Calendario de pagos" currentStep={11} contractId={id} variant="extra">
      {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-3 md:grid-cols-5">
        <Info label="Canon mensual" value={`$${leaseData.monthlyRent.toLocaleString("es-CO")}`} />
        <Info label="Duración (meses)" value={`${leaseData.termMonths}`} />
        <Info label="Fecha inicio" value={leaseData.startDate || "-"} />
        <Info label="Día máximo pago" value={`${leaseData.paymentDueDay}`} />
        <Info label="Programados" value={`${schedule.length}`} />
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        <Info label="Próximos" value={`${summary.upcoming}`} />
        <Info label="Vencidos" value={`${summary.late}`} />
        <Info label="Estado" value={summary.late > 0 ? "Con vencidos" : "Al día"} />
      </div>
      <p className="mt-3 rounded-lg border border-slate-200 bg-white/75 p-3 text-xs text-slate-600">
        El calendario se genera <strong>automáticamente</strong> al configurar tus pagos en{" "}
        <a href={`/dashboard/contracts/${id}/pagos-recordatorios`} className="font-semibold text-violet-700 underline">
          Pagos y recordatorios
        </a>
        . Aquí puedes verlo y, si lo necesitas, regenerarlo. Los recordatorios al inquilino se envían solos los días que
        configuraste.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={generate} disabled={saving || !contractVersionId} className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800">
          {saving ? "Generando..." : "Regenerar calendario"}
        </button>
      </div>

      {/* Solo lectura: la configuración de recordatorios (método de pago y días de
          aviso) vive SOLO en «Pagos y recordatorios», para no tener dos editores
          que se desincronicen. Aquí se muestra el estado actual. */}
      <section className="mt-4 rounded-lg border border-slate-200 bg-white/75 p-3 text-xs text-slate-700">
        <p>
          <strong>Recordatorios al inquilino:</strong>{" "}
          {settings.enabled
            ? `activos — ${settings.defaultDaysBefore} día(s) antes de cada vencimiento y el día del vencimiento.`
            : "desactivados."}
        </p>
        <p className="mt-1 text-slate-500">
          Para cambiar el método de pago o los días de aviso, ve a{" "}
          <a href={`/dashboard/contracts/${id}/pagos-recordatorios`} className="font-semibold text-violet-700 underline">
            Pagos y recordatorios
          </a>
          .
        </p>
      </section>

      <div className="mt-4 overflow-auto rounded border border-slate-300">
        <table className="min-w-full text-xs text-slate-700">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="px-2 py-1 text-left">Periodo</th>
              <th className="px-2 py-1 text-left">Vence</th>
              <th className="px-2 py-1 text-left">Esperado</th>
              <th className="px-2 py-1 text-left">Estado</th>
              <th className="px-2 py-1 text-left">Recordatorio</th>
              <th className="px-2 py-1 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((s) => (
              <tr key={s.id} className="border-b border-slate-300">
                <td className="px-2 py-1">{s.periodLabel}</td>
                <td className="px-2 py-1">{s.dueDate}</td>
                <td className="px-2 py-1">${s.expectedAmount.toLocaleString("es-CO")}</td>
                <td className="px-2 py-1">{s.status}</td>
                <td className="px-2 py-1">{s.reminderEnabled ? `${s.reminderDaysBefore} día(s)` : "Desactivado"}</td>
                <td className="px-2 py-1">
                  <Link href={`/dashboard/contracts/${id}/payments/new?contractVersionId=${encodeURIComponent(contractVersionId)}&scheduledPaymentId=${encodeURIComponent(s.id)}`} className="text-violet-700">Registrar pago</Link>
                  {s.paymentLogId ? (
                    <Link href={`/dashboard/contracts/${id}/payments/${s.paymentLogId}`} className="ml-2 text-sky-700">
                      Ver soporte
                    </Link>
                  ) : null}
                  <button type="button" onClick={() => void updateOne(s, { status: "disputed" })} className="ml-2 text-amber-700">Marcar disputado</button>
                  <button type="button" onClick={() => void updateOne(s, { status: "cancelled" })} className="ml-2 text-rose-700">Cancelar</button>
                </td>
              </tr>
            ))}
            {schedule.length === 0 && <tr><td className="px-2 py-3 text-slate-600" colSpan={6}>Sin calendario programado.</td></tr>}
          </tbody>
        </table>
      </div>
    </WizardShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-300 bg-white/95 p-3">
      <p className="text-[11px] text-slate-600">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

