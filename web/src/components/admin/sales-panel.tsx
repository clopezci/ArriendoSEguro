"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Sale = {
  internalCode: string;
  internalNumber: number;
  buyerEmail: string;
  buyerName?: string;
  buyerDocument?: string;
  amountCop: number;
  currency: string;
  provider: string;
  providerPaymentId?: string;
  orderId?: string;
  leaseProcessId?: string | null;
  date: string;
  status: string;
};

function money(n: number) {
  return "$" + (n || 0).toLocaleString("es-CO");
}
function fmtDate(iso: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota" });
  } catch {
    return iso;
  }
}

export function SalesPanel() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalCop, setTotalCop] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sales", { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; sales?: Sale[]; totalCop?: number };
      if (json?.success) {
        setSales(json.sales ?? []);
        setTotalCop(json.totalCop ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/sales", { method: "POST", headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; added?: number; total?: number };
      if (json?.success) {
        setMsg(`✅ Sincronizado: ${json.added ?? 0} venta(s) nueva(s), ${json.total ?? 0} en total.`);
        await load();
      } else setMsg("No se pudo sincronizar.");
    } catch {
      setMsg("Error de red al sincronizar.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    const header = ["N interno", "Fecha", "Cliente (correo)", "Nombre", "Documento", "Monto COP", "Moneda", "Proveedor", "Referencia pago", "Contrato", "Estado"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.map(esc).join(",")];
    for (const s of sales) {
      lines.push([s.internalCode, fmtDate(s.date), s.buyerEmail, s.buyerName ?? "", s.buyerDocument ?? "", s.amountCop, s.currency, s.provider, s.providerPaymentId ?? "", s.leaseProcessId ?? "", s.status].map(esc).join(","));
    }
    try {
      const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventas-arriendoseguro-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
        <h3 className="text-sm font-bold text-violet-900">🧾 Libro de ventas (numeración interna)</h3>
        <p className="mt-1 text-xs text-slate-600">
          Registro interno de cada venta aprobada, con número propio (AS-00001…). Se actualiza <strong>solo</strong> con cada
          venta; el botón sincroniza el histórico de Wompi. Descárgalo si necesitas registrar en la DIAN manualmente.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void sync()} disabled={loading} className="rounded-lg bg-[#5646E5] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {loading ? "…" : "Sincronizar con Wompi"}
        </button>
        <button type="button" onClick={downloadCsv} disabled={sales.length === 0} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
          ⬇ Descargar CSV
        </button>
        <span className="ml-auto text-sm text-slate-600">
          <strong>{sales.length}</strong> ventas · Total <strong>{money(totalCop)}</strong>
        </span>
      </div>
      {msg && <p className="text-xs font-semibold text-emerald-700">{msg}</p>}

      <div className="max-h-[60vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Nº</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Monto</th>
              <th className="px-3 py-2">Proveedor</th>
              <th className="px-3 py-2">Contrato</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-400">Sin ventas. Pulsa “Sincronizar con Wompi” para traer el histórico.</td></tr>
            )}
            {sales.map((s) => (
              <tr key={s.internalCode} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-700">{s.internalCode}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(s.date)}</td>
                <td className="px-3 py-2 text-slate-700">{s.buyerName || s.buyerEmail}</td>
                <td className="px-3 py-2 font-semibold text-slate-800">{money(s.amountCop)}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{s.provider}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{s.leaseProcessId || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
