"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";

type Row = { id: string; ownerEmail: string; landlordName: string; tenantName: string; address: string; updatedAt: string };
type Party = { fullName?: string; documentType?: string; documentNumber?: string; email?: string; phone?: string; city?: string } | null;
type Expediente = {
  contract: { id: string; ownerEmail: string; landlord: Party; tenant: Party; codebtor: Party; property: { address?: string; city?: string } | null; version: { versionNumber?: number; documentHash?: string } | null; started: boolean; startedAt: string | null };
  annexes: { title: string; annexType: string; status: string; pdfUrl: string | null }[];
  signatures: { partyType: string; signerEmail: string; status: string; signedAt: string | null }[];
  documents: { docType: string; fileName: string }[];
  payments: { amount: number; status: string; method: string; at: string }[];
};

export default function AdminExpedientesPage() {
  const { user, loading } = useAuth();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [sel, setSel] = useState<Expediente | null>(null);
  const [busy, setBusy] = useState(false);

  const search = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contracts/list?q=${encodeURIComponent(q)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; contracts?: Row[] };
      setRows(j.success ? (j.contracts ?? []) : []);
    } catch { setRows([]); }
    finally { setBusy(false); }
  }, [user, q]);
  useEffect(() => { if (user) void search(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openExpediente(id: string) {
    if (!user) return;
    setSel(null);
    try {
      const res = await fetch(`/api/admin/contracts/expediente?contractId=${encodeURIComponent(id)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean } & Expediente;
      if (j.success) setSel(j);
    } catch { /* noop */ }
  }

  if (loading) return <p className="p-6 text-slate-500">Cargando…</p>;
  if (!user) return <p className="p-6 text-slate-500">Inicia sesión como administrador.</p>;

  const P = ({ label, p }: { label: string; p: Party }) =>
    p ? (
      <p className="text-sm text-slate-700"><b>{label}:</b> {p.fullName || "—"} · {p.documentType} {p.documentNumber} · {p.email} · {p.phone} · {p.city}</p>
    ) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Expedientes (admin)</h1>
        <Link href="/admin" className="text-sm font-semibold text-violet-700 hover:underline">← Volver al panel</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void search()}
          placeholder="Buscar por correo, nombre, dirección o id…" className="min-w-[260px] flex-1 rounded border border-slate-300 px-3 py-2 text-sm" />
        <button type="button" onClick={() => void search()} disabled={busy} className="rounded bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "…" : "Buscar"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Resultados ({rows?.length ?? 0})</p>
          <div className="max-h-[70vh] space-y-1.5 overflow-auto">
            {(rows ?? []).map((r) => (
              <button key={r.id} type="button" onClick={() => void openExpediente(r.id)}
                className={`block w-full rounded-lg border p-2.5 text-left text-sm transition hover:border-violet-400 ${sel?.contract.id === r.id ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}>
                <p className="truncate font-semibold text-slate-800">{r.address || "Sin dirección"}</p>
                <p className="truncate text-xs text-slate-500">{r.landlordName || "—"}{r.tenantName ? ` · Inq: ${r.tenantName}` : ""}</p>
                <p className="truncate text-[11px] text-slate-400">{r.ownerEmail} · {r.id}</p>
              </button>
            ))}
            {rows && rows.length === 0 && <p className="text-sm text-slate-400">Sin resultados.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/90 p-3">
          {!sel ? (
            <p className="text-sm text-slate-400">Selecciona un expediente para ver el detalle.</p>
          ) : (
            <div className="max-h-[70vh] space-y-3 overflow-auto text-slate-800">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Contrato</p>
                <p className="text-sm"><b>Inmueble:</b> {sel.contract.property?.address || "—"}{sel.contract.property?.city ? `, ${sel.contract.property.city}` : ""}</p>
                <P label="Arrendador" p={sel.contract.landlord} />
                <P label="Arrendatario" p={sel.contract.tenant} />
                <P label="Codeudor" p={sel.contract.codebtor} />
                <p className="text-xs text-slate-500">Versión {sel.contract.version?.versionNumber ?? "—"} · hash {sel.contract.version?.documentHash?.slice(0, 12) ?? "—"} · {sel.contract.started ? "🔒 iniciado" : "en preparación"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Firmas ({sel.signatures.length})</p>
                {sel.signatures.map((s, i) => <p key={i} className="text-xs text-slate-600">{s.partyType} · {s.signerEmail} · <b>{s.status}</b>{s.signedAt ? ` · ${new Date(s.signedAt).toLocaleDateString("es-CO")}` : ""}</p>)}
                {sel.signatures.length === 0 && <p className="text-xs text-slate-400">Sin firmas.</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Anexos / documentos ({sel.annexes.length})</p>
                {sel.annexes.map((a, i) => (
                  <p key={i} className="text-xs text-slate-600">
                    {a.title || a.annexType} · {a.status}{" "}
                    {a.pdfUrl ? <a href={a.pdfUrl} target="_blank" rel="noreferrer" className="font-semibold text-violet-700 underline">Descargar PDF</a> : "(sin PDF)"}
                  </p>
                ))}
                {sel.documents.map((d, i) => <p key={`d${i}`} className="text-xs text-slate-600">📎 {d.docType}: {d.fileName}</p>)}
                {sel.annexes.length === 0 && sel.documents.length === 0 && <p className="text-xs text-slate-400">Sin documentos.</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Pagos ({sel.payments.length})</p>
                {sel.payments.map((p, i) => <p key={i} className="text-xs text-slate-600">${Number(p.amount).toLocaleString("es-CO")} · {p.status} · {p.method}{p.at ? ` · ${new Date(p.at).toLocaleDateString("es-CO")}` : ""}</p>)}
                {sel.payments.length === 0 && <p className="text-xs text-slate-400">Sin pagos registrados.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
