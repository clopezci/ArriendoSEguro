"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { availablePaymentYears, type CertifiablePayment } from "@/domain/payments/paymentsCertificate";

type PaymentLike = {
  periodLabel: string;
  dueDate: string;
  paidDate?: string;
  amountDue: number;
  amountPaid: number;
  paymentStatus: string;
  paymentMethod?: string;
  notes?: string;
};

/**
 * Exportación discreta de pagos registrados (CSV y certificado en PDF).
 * Neutral a propósito: documento informativo de lo que se registró. Si no hay
 * pagos registrados, no se descarga nada (se avisa).
 */
export function PaymentsExportCard({
  contractId,
  contractVersionId,
  payments,
}: {
  contractId: string;
  contractVersionId: string;
  payments: PaymentLike[];
}) {
  const { user } = useAuth();
  const [year, setYear] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const years = useMemo(
    () => availablePaymentYears(payments as CertifiablePayment[]),
    [payments],
  );
  const hasPaid = years.length > 0;

  async function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadCsv() {
    if (!user || !contractVersionId) return;
    setBusy(true);
    setMsg("");
    try {
      const qs = new URLSearchParams({ contractId, contractVersionId });
      if (year) qs.set("year", year);
      const res = await fetch(`/api/payments/export-csv?${qs.toString()}`, {
        headers: { ...(await buildAuthHeaders(user)) },
      });
      if (!res.ok) {
        setMsg("No se pudo exportar el CSV.");
        return;
      }
      await triggerDownload(await res.blob(), `pagos-registrados${year ? `-${year}` : ""}.csv`);
    } catch {
      setMsg("Error de red al exportar.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadCertificate() {
    if (!user || !contractVersionId) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/payments/certificate", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId, contractVersionId, ...(year ? { year: Number(year) } : {}) }),
      });
      if (!res.ok) {
        setMsg("No se pudo generar el certificado.");
        return;
      }
      await triggerDownload(await res.blob(), `certificado-pagos${year ? `-${year}` : ""}.pdf`);
    } catch {
      setMsg("Error de red al generar el certificado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded border border-slate-300 bg-white/95 p-3">
      <p className="text-xs font-medium text-slate-800">Exportar mis pagos registrados</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Documento informativo de los pagos que registraste aquí. Si no has registrado pagos, no habrá nada que exportar.
      </p>
      {!hasPaid ? (
        <p className="mt-2 text-[11px] text-slate-500">Aún no hay pagos registrados para exportar.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-slate-600">
            Periodo
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="ml-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
            >
              <option value="">Todos</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadCsv()}
            className="rounded border border-slate-400 px-3 py-1.5 text-[11px] text-slate-800 disabled:opacity-50"
          >
            Descargar CSV
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadCertificate()}
            className="rounded border border-emerald-500 px-3 py-1.5 text-[11px] text-emerald-700 disabled:opacity-50"
          >
            Certificado de pagos (PDF)
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-[11px] text-slate-600">{msg}</p>}
    </section>
  );
}
