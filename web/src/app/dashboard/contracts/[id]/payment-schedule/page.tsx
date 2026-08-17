"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { BentoShell } from "@/components/layout/bento-shell";
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
    defaultDaysBefore: 1,
    tenantEmail: "",
    landlordCopyEnabled: false,
    landlordEmail: "",
    customMessage: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Check rápido (legalizar meses ya pagados): fila en curso + input de soporte.
  const [busyRow, setBusyRow] = useState("");
  const [pendingRow, setPendingRow] = useState<ScheduledPayment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const list = await fetch(`/api/payments/schedule/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`, { headers: { ...(await buildAuthHeaders(user)) } }).then((r) => r.json());
    if (list?.success) {
      // Orden por fecha de vencimiento (más cercana primero).
      setSchedule(
        ((list.scheduledPayments ?? []) as ScheduledPayment[])
          .slice()
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
      );
      if (list.reminderSettings) {
        setSettings({
          enabled: Boolean(list.reminderSettings.enabled),
          defaultDaysBefore: Number(list.reminderSettings.defaultDaysBefore ?? 1),
          tenantEmail: String(list.reminderSettings.tenantEmail ?? ""),
          landlordCopyEnabled: Boolean(list.reminderSettings.landlordCopyEnabled),
          landlordEmail: String(list.reminderSettings.landlordEmail ?? ""),
          customMessage: String(list.reminderSettings.customMessage ?? ""),
        });
      }
    }
  }, [id, user]);

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
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
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

  /** Crea el pago del mes (rápido): valor esperado, pagado = esperado, fecha de
   *  pago = vencimiento. Con soporte opcional (el dueño lo da por recibido). */
  async function createQuickPayment(
    s: ScheduledPayment,
    support?: { url: string; name: string; type: string; size: number },
  ): Promise<boolean> {
    const res = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await buildAuthHeaders(user ?? null)) },
      body: JSON.stringify({
        leaseProcessId: id,
        contractId: id,
        contractVersionId,
        periodLabel: s.periodLabel,
        dueDate: s.dueDate,
        paidDate: s.dueDate,
        amountDue: s.expectedAmount,
        amountPaid: s.expectedAmount,
        paymentMethod: "transferencia bancaria",
        scheduledPaymentId: s.id,
        ...(support ? { supportFileUrl: support.url, supportFileName: support.name, supportFileType: support.type, supportFileSize: support.size } : {}),
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { success?: boolean; errors?: { message?: string }[] };
    if (!res.ok || !j.success) {
      setError(j.errors?.[0]?.message ?? "No se pudo registrar el pago.");
      return false;
    }
    return true;
  }

  /** El check de un mes: pregunta si adjunta soporte; si no, confirma sin soporte. */
  function onQuickCheck(s: ScheduledPayment) {
    if (s.status === "reported_paid" || busyRow) return;
    setError("");
    const withSupport = window.confirm(
      `Registrar el pago de ${s.periodLabel} ($${s.expectedAmount.toLocaleString("es-CO")}).\n\n¿Quieres adjuntar el soporte de pago?\n\nAceptar = sí, adjuntar comprobante · Cancelar = registrar sin soporte`,
    );
    if (withSupport) {
      setPendingRow(s);
      fileInputRef.current?.click();
      return;
    }
    const ok = window.confirm("¿Estás de acuerdo con que el pago quede registrado SIN soporte? Como arrendador (dueño) lo das por recibido.");
    if (!ok) return;
    void (async () => {
      setBusyRow(s.id);
      if (await createQuickPayment(s)) await load();
      setBusyRow("");
    })();
  }

  /** Llega el archivo elegido para el mes pendiente: sube y registra con soporte. */
  async function onSupportPicked(file: File | null) {
    const s = pendingRow;
    setPendingRow(null);
    if (!s || !file) return;
    setBusyRow(s.id);
    setError("");
    try {
      const up = await fetch("/api/payments/support/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user ?? null)) },
        body: JSON.stringify({ contractId: id, contractVersionId, filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      const data = (await up.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!up.ok || !data.success || !data.uploadUrl || !data.storagePath) {
        setError(data.errors?.[0]?.message ?? "No se pudo preparar la subida del soporte.");
        return;
      }
      const put = await fetch(data.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) { setError("No se pudo subir el soporte."); return; }
      if (await createQuickPayment(s, { url: data.storagePath, name: file.name, type: file.type || "application/octet-stream", size: file.size })) await load();
    } catch {
      setError("Error de red al registrar el pago con soporte.");
    } finally {
      setBusyRow("");
    }
  }

  return (
    <BentoShell>
      <WizardShell title="Calendario de pagos" currentStep={11} contractId={id} variant="extra" lean>
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

      {/* Explicación del check rápido vs. registrar pago normal. */}
      <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
        <strong>Check rápido:</strong> marca ✓ un mes para darlo por <strong>pagado</strong> al instante (te pregunta si
        adjuntas soporte). Ideal para <strong>legalizar un arriendo que ya lleva varios meses</strong>: ve marcando de
        arriba hacia abajo. Para el pago del <strong>mes a mes</strong> con todos los datos, usa <strong>«Registrar pago»</strong> en Acciones.
      </p>

      {/* Input oculto de soporte para el check rápido. */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          void onSupportPicked(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="mt-2 overflow-auto rounded-2xl border-2 border-slate-200">
        <table className="min-w-full text-xs text-slate-700">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="px-2 py-1 text-left">✓ Pagado</th>
              <th className="px-2 py-1 text-left">Periodo</th>
              <th className="px-2 py-1 text-left">Vence</th>
              <th className="px-2 py-1 text-left">Esperado</th>
              <th className="px-2 py-1 text-left">Estado</th>
              <th className="px-2 py-1 text-left">Recordatorio</th>
              <th className="px-2 py-1 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((s) => {
              const paid = s.status === "reported_paid";
              return (
              <tr key={s.id} className={`border-b border-slate-300 ${paid ? "bg-emerald-50/50" : ""}`}>
                <td className="px-2 py-1">
                  {busyRow === s.id ? (
                    <span className="text-[11px] text-slate-400">…</span>
                  ) : paid ? (
                    <span className="text-base font-bold text-emerald-600" title="Pago registrado">✓</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => onQuickCheck(s)}
                      disabled={Boolean(busyRow)}
                      className="h-5 w-5 accent-[#12B886]"
                      title="Marcar este mes como pagado"
                    />
                  )}
                </td>
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
              );
            })}
            {schedule.length === 0 && <tr><td className="px-2 py-3 text-slate-600" colSpan={7}>Sin calendario programado.</td></tr>}
          </tbody>
        </table>
      </div>
    </WizardShell>
    </BentoShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white/95 p-3">
      <p className="text-[11px] text-slate-600">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

