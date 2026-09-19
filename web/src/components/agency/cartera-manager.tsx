"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Contract = {
  contractId: string;
  tenantName: string;
  tenantEmail: string;
  propertyLabel: string;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  agencyStatus: "draft" | "sent" | "signed";
  contractStatus: string;
  createdAtIso: string;
};

const STATUS: Record<Contract["agencyStatus"], { label: string; cls: string }> = {
  draft: { label: "Borrador", cls: "bg-slate-100 text-slate-600" },
  sent: { label: "Enviado a firma", cls: "bg-amber-100 text-amber-700" },
  signed: { label: "Firmado", cls: "bg-emerald-100 text-emerald-700" },
};

function money(n: number): string {
  return "$" + (n || 0).toLocaleString("es-CO");
}

export function CarteraManager({ agencyId }: { agencyId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewHtml, setViewHtml] = useState<string | null>(null);
  const [viewTitle, setViewTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agency/${agencyId}/contracts`, { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; contracts?: Contract[] };
      if (json?.success) setRows(json.contracts ?? []);
    } finally {
      setLoading(false);
    }
  }, [agencyId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function view(c: Contract) {
    setViewTitle(`${c.tenantName} — ${c.propertyLabel}`);
    setViewHtml("<p style='font-family:sans-serif;padding:20px'>Cargando…</p>");
    try {
      const res = await fetch(`/api/agency/${agencyId}/contracts/${c.contractId}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const json = (await res.json()) as { success?: boolean; html?: string };
      setViewHtml(json?.success ? json.html ?? "<p>Sin contenido.</p>" : "<p>No se pudo cargar el contrato.</p>");
    } catch {
      setViewHtml("<p>Error de red.</p>");
    }
  }

  const counts = {
    draft: rows.filter((r) => r.agencyStatus === "draft").length,
    sent: rows.filter((r) => r.agencyStatus === "sent").length,
    signed: rows.filter((r) => r.agencyStatus === "signed").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Borradores</p><p className="text-xl font-bold text-slate-800">{counts.draft}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Enviados</p><p className="text-xl font-bold text-amber-700">{counts.sent}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Firmados</p><p className="text-xl font-bold text-emerald-700">{counts.signed}</p></div>
      </div>

      {loading && <p className="text-sm text-slate-500">Cargando cartera…</p>}
      {!loading && rows.length === 0 && <p className="text-xs text-slate-400">Aún no hay contratos. Genera un lote en la pestaña “Generar en lote”.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Inquilino</th>
                <th className="px-3 py-2">Inmueble</th>
                <th className="px-3 py-2">Canon</th>
                <th className="px-3 py-2">Vigencia</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.contractId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{c.tenantName}</td>
                  <td className="px-3 py-2 text-slate-600">{c.propertyLabel}</td>
                  <td className="px-3 py-2 text-slate-600">{money(c.monthlyRent)}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{c.startDate} → {c.endDate}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[c.agencyStatus].cls}`}>{STATUS[c.agencyStatus].label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => void view(c)} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewHtml !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewHtml(null)}>
          <div className="flex h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <span className="truncate text-sm font-semibold text-slate-700">{viewTitle}</span>
              <button type="button" onClick={() => setViewHtml(null)} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <iframe title="Contrato" srcDoc={viewHtml} className="flex-1 rounded-b-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
