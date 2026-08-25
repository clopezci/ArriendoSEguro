"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WizardShell } from "@/components/contracts/wizard-shell";
import { useDraftGuard } from "@/components/contracts/draft-tools";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { FileButton } from "@/components/ui/file-button";

type SchedRow = { id: string; periodLabel?: string; dueDate?: string; expectedAmount?: number; status?: string };

export default function NewPaymentPage() {
  const id = String(useParams<{ id: string }>().id);
  const contractVersionId = useSearchParams().get("contractVersionId") ?? "";
  const scheduledPaymentIdParam = useSearchParams().get("scheduledPaymentId") ?? "";
  const router = useRouter();
  const { state } = useDraftGuard(id);
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<SchedRow[]>([]);
  const [scheduledPaymentId, setScheduledPaymentId] = useState(scheduledPaymentIdParam);
  const [periodLabel, setPeriodLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [amountDue, setAmountDue] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("transferencia bancaria");
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [supportFileName, setSupportFileName] = useState("");
  const [supportFileType, setSupportFileType] = useState("");
  const [supportFileSize, setSupportFileSize] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** Rellena todos los campos a partir de un mes del calendario del contrato. */
  const applyScheduleRow = useCallback((s: SchedRow) => {
    setScheduledPaymentId(s.id);
    setPeriodLabel(String(s.periodLabel ?? ""));
    setDueDate(String(s.dueDate ?? ""));
    setPaidDate(String(s.dueDate ?? "")); // por defecto = vencimiento (editable)
    setAmountDue(String(Number(s.expectedAmount ?? 0)));
    setAmountPaid(String(Number(s.expectedAmount ?? 0))); // por defecto = esperado (editable)
  }, []);

  // Carga el calendario de pagos del contrato para el desplegable de meses.
  useEffect(() => {
    if (!contractVersionId) return;
    void (async () => {
      const res = await fetch(
        `/api/payments/schedule/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(contractVersionId)}`,
        { headers: { ...(await buildAuthHeaders(user)) } },
      );
      const data = await res.json();
      if (!res.ok || !data?.success) return;
      const rows: SchedRow[] = Array.isArray(data.scheduledPayments) ? data.scheduledPayments : [];
      // Ordena por fecha de vencimiento (cronológico = lexicográfico en YYYY-MM-DD).
      rows.sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")));
      setSchedule(rows);
      // Si venimos de "registrar" un mes puntual, precarga ese; si no, el primero
      // que aún no está pagado.
      const target = scheduledPaymentIdParam
        ? rows.find((r) => r.id === scheduledPaymentIdParam)
        : rows.find((r) => r.status !== "reported_paid");
      if (target) applyScheduleRow(target);
    })();
  }, [contractVersionId, id, user, scheduledPaymentIdParam, applyScheduleRow]);

  if (state !== "ready") return <p className="text-sm text-slate-700">Cargando...</p>;

  async function uploadSupportIfAny(): Promise<string | undefined> {
    if (!supportFile) return undefined;
    const res = await fetch("/api/payments/support/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json", ...(await buildAuthHeaders(user ?? null)) },
      body: JSON.stringify({
        contractId: id,
        contractVersionId,
        filename: supportFile.name,
        contentType: supportFile.type || "application/octet-stream",
        sizeBytes: supportFile.size,
      }),
    });
    const data = (await res.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
    if (!res.ok || !data.success || !data.uploadUrl || !data.storagePath) {
      throw new Error(data.errors?.[0]?.message ?? "No se pudo preparar la subida del soporte.");
    }
    const put = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "content-type": supportFile.type || "application/octet-stream" },
      body: supportFile,
    });
    if (!put.ok) throw new Error("No se pudo subir el archivo de soporte.");
    return data.storagePath;
  }

  async function onSubmit() {
    setSaving(true);
    setError("");
    try {
      if (!periodLabel.trim() || periodLabel.trim().length < 3) throw new Error("Elige o escribe el periodo pagado (ej. Mayo 2026).");
      if (!dueDate || dueDate.length < 8) throw new Error("Falta la fecha de vencimiento (YYYY-MM-DD).");
      if (!(Number(amountPaid) > 0)) throw new Error("Escribe el valor pagado (debe ser mayor a $0).");
      // Confirmación si registras un pago SIN comprobante (permitido para el dueño,
      // que lo da por recibido; el inquilino sí debe adjuntarlo).
      if (!supportFile && Number(amountPaid) > 0) {
        const ok = window.confirm("¿Seguro que quieres registrar el pago SIN comprobante? Como dueño puedes hacerlo (lo das por recibido). Podrás adjuntar el soporte después.");
        if (!ok) { setSaving(false); return; }
      }
      const uploadedSupportUrl = await uploadSupportIfAny();
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user ?? null)) },
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
          supportFileUrl: uploadedSupportUrl || undefined,
          supportFileName: supportFileName || undefined,
          supportFileType: supportFileType || undefined,
          supportFileSize: supportFileSize || undefined,
          notes,
          scheduledPaymentId: scheduledPaymentId || undefined,
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
    <WizardShell title="Registrar pago" currentStep={11} contractId={id} variant="extra" lean>
      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}

      {/* Elegir el mes del contrato: rellena vencimiento, valores y fecha de pago. */}
      {schedule.length > 0 && (
        <label className="mb-3 block text-xs font-medium text-slate-700">
          Mes del contrato
          <select
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm"
            value={scheduledPaymentId}
            onChange={(e) => {
              const row = schedule.find((s) => s.id === e.target.value);
              if (row) applyScheduleRow(row);
            }}
          >
            <option value="">— Elige el mes —</option>
            {schedule.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.periodLabel || s.dueDate) ?? "—"}
                {s.dueDate ? ` · vence ${s.dueDate}` : ""}
                {s.status === "reported_paid" ? " · ya pagado" : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-slate-500">Al elegir el mes se completan solos el vencimiento, el valor y la fecha de pago. Puedes ajustar lo que necesites.</span>
        </label>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Periodo pagado" value={periodLabel} onChange={setPeriodLabel} placeholder="Mayo 2026" />
        <Input label="Fecha de vencimiento" value={dueDate} onChange={setDueDate} placeholder="YYYY-MM-DD" type="date" />
        <Input label="Fecha de pago (por defecto = vencimiento; cámbiala si aplica)" value={paidDate} onChange={setPaidDate} placeholder="YYYY-MM-DD" type="date" />
        <Input label="Valor esperado" value={amountDue} onChange={setAmountDue} placeholder="1.000.000" money />
        <Input label="Valor pagado (por defecto = esperado; cámbialo si aplica)" value={amountPaid} onChange={setAmountPaid} placeholder="1.000.000" money />
        <label className="text-xs text-slate-700">
          Método de pago
          <select className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option>transferencia bancaria</option>
            <option>efectivo con constancia</option>
            <option>consignación</option>
            <option>otro</option>
          </select>
        </label>
        <div className="text-xs text-slate-700 md:col-span-2">
          <span className="block text-sm font-semibold text-slate-800">Comprobante de pago <span className="font-normal text-slate-400">(opcional, recomendado)</span></span>
          <div className="mt-1.5">
            <FileButton
              file={supportFile}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              label="Elegir comprobante"
              onFile={(file) => {
                setSupportFile(file);
                setSupportFileName(file?.name ?? "");
                setSupportFileType(file?.type ?? "");
                setSupportFileSize(file?.size ?? 0);
              }}
            />
          </div>
        </div>
      </div>

      <p className="mt-2 rounded border border-slate-200 bg-white/95 p-3 text-xs text-slate-700">
        Como <b>arrendador (dueño)</b>, el comprobante es <b>opcional</b>: al registrar el pago lo das por recibido. (Si es el <b>inquilino</b> quien registra desde su enlace, el comprobante <b>sí</b> es obligatorio y tú lo confirmas). ArriendoSeguro no recauda dinero ni verifica con bancos; el soporte solo deja evidencia documental. Tu rol lo determina el sistema según tu usuario y el contrato.
      </p>
      <label className="mt-3 block text-xs text-slate-700">
        Observaciones
        <textarea className="mt-1 min-h-24 w-full rounded border border-slate-300 bg-white p-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onSubmit} disabled={saving} className="rounded bg-[#5646E5] px-4 py-2 text-sm text-white">{saving ? "Guardando..." : "Guardar pago"}</button>
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
  money = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  /** Campo de dinero: muestra puntos de miles y guarda solo dígitos (sin decimales). */
  money?: boolean;
}) {
  const display = money ? (value ? Number(value.replace(/\D/g, "")).toLocaleString("es-CO") : "") : value;
  return (
    <label className="text-xs text-slate-700">
      {label}
      <input
        type={money ? "text" : type}
        inputMode={money ? "numeric" : undefined}
        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm"
        value={display}
        onChange={(e) => onChange(money ? e.target.value.replace(/\D/g, "") : e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
