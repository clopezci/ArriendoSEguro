"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { FileButton } from "@/components/ui/file-button";

type Sched = { id: string; periodLabel?: string; dueDate?: string; expectedAmount?: number; status?: string };

/**
 * Pagos del INQUILINO: ve su calendario y REGISTRA un pago con comprobante
 * (obligatorio para el inquilino; el dueño lo confirma). Reusa los endpoints
 * gateados por participante (schedule/list, support/upload-url, payments/create).
 */
export default function InquilinoPagosPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [versionId, setVersionId] = useState("");
  const [rows, setRows] = useState<Sched[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const lv = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`).then((r) => r.json());
      const vId = lv?.version?.id ?? lv?.contract?.currentVersionId ?? "";
      setVersionId(vId);
      if (!vId) { setRows([]); return; }
      const authH = await buildAuthHeaders(user);
      const j = await fetch(`/api/payments/schedule/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(vId)}`, { headers: { ...authH } }).then((r) => r.json());
      const list: Sched[] = Array.isArray(j?.scheduledPayments) ? j.scheduledPayments : [];
      list.sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")));
      setRows(list);
    } catch { setRows([]); } finally { setLoading(false); }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);

  function openRow(s: Sched) {
    setOpenFor(openFor === s.id ? null : s.id);
    setFile(null);
    setAmount(String(Number(s.expectedAmount ?? 0)));
    setPaidDate(String(s.dueDate ?? ""));
    setMsg("");
  }

  async function register(s: Sched) {
    if (!user || !versionId) return;
    if (!file) { setMsg("Adjunta el comprobante de pago (obligatorio)."); return; }
    const amt = Number(amount.replace(/\D/g, "")) || 0;
    if (amt <= 0) { setMsg("Escribe el valor pagado (debe ser mayor a $0)."); return; }
    setBusy(true); setMsg("");
    try {
      const authH = { "content-type": "application/json", ...(await buildAuthHeaders(user)) };
      const up = await fetch("/api/payments/support/upload-url", {
        method: "POST", headers: authH,
        body: JSON.stringify({ contractId: id, contractVersionId: versionId, filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      const upd = (await up.json()) as { success?: boolean; uploadUrl?: string; storagePath?: string; errors?: { message?: string }[] };
      if (!up.ok || !upd.success || !upd.uploadUrl || !upd.storagePath) { setMsg(upd.errors?.[0]?.message ?? "No se pudo preparar la subida."); return; }
      const put = await fetch(upd.uploadUrl, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) { setMsg("No se pudo subir el comprobante."); return; }
      const res = await fetch("/api/payments/create", {
        method: "POST", headers: authH,
        body: JSON.stringify({
          leaseProcessId: id, contractId: id, contractVersionId: versionId,
          periodLabel: s.periodLabel ?? "", dueDate: s.dueDate ?? "", paidDate: paidDate || s.dueDate,
          amountDue: Number(s.expectedAmount ?? 0), amountPaid: amt,
          paymentMethod: "transferencia bancaria", scheduledPaymentId: s.id,
          supportFileUrl: upd.storagePath, supportFileName: file.name, supportFileType: file.type || "application/octet-stream", supportFileSize: file.size,
        }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo registrar el pago."); return; }
      setMsg("✅ Pago registrado con tu comprobante. El dueño lo confirmará.");
      setOpenFor(null);
      await load();
    } catch { setMsg("Error de red."); } finally { setBusy(false); }
  }

  return (
    <div className="relative min-h-screen bg-[#F5F3EF] text-[#17151F]">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Link href="/inquilino" className="text-sm font-semibold text-[#5646E5] hover:underline">← Mis arriendos</Link>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Mis pagos</h1>
        <p className="mt-2 text-slate-500">Registra tu pago del mes adjuntando el comprobante; el dueño lo confirma. Aquí ves el calendario y el estado.</p>

        {msg && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}

        {loading ? (
          <p className="mt-8 text-slate-400">Cargando…</p>
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white/70 p-8 text-center text-slate-500">Aún no hay calendario de pagos en este contrato.</div>
        ) : (
          <div className="mt-6 space-y-3">
            {rows.map((s) => {
              const paid = s.status === "reported_paid";
              return (
                <div key={s.id} className={`rounded-2xl border-2 p-4 ${paid ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white/90"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{s.periodLabel || s.dueDate}</p>
                      <p className="text-xs text-slate-500">Vence {s.dueDate} · ${Number(s.expectedAmount ?? 0).toLocaleString("es-CO")} · {paid ? "Pagado ✓" : s.status}</p>
                    </div>
                    {!paid && (
                      <button type="button" onClick={() => openRow(s)} className="rounded-xl bg-[#5646E5] px-3 py-2 text-sm font-bold text-white">Registrar pago</button>
                    )}
                  </div>
                  {openFor === s.id && !paid && (
                    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs text-slate-600">
                        <span className="block text-sm font-semibold text-slate-800">Comprobante de pago (obligatorio)</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">Sube una foto o el PDF del comprobante.</span>
                        <div className="mt-2">
                          <FileButton file={file} onFile={setFile} accept="image/*,.pdf" label="Elegir comprobante" />
                        </div>
                      </div>
                      <label className="block text-xs text-slate-600">Valor pagado
                        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      </label>
                      <label className="block text-xs text-slate-600">Fecha de pago
                        <input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      </label>
                      <button type="button" disabled={busy} onClick={() => void register(s)} className="w-full rounded-xl bg-[#12B886] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Registrando…" : "Enviar pago con comprobante"}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
