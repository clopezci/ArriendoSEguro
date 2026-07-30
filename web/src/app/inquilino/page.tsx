"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { MAINTENANCE_CATEGORY_LABELS } from "@/domain/maintenance/maintenance";

type TenantContract = { contractId: string; address: string; landlordName: string; role: "tenant" | "codebtor" };
const CATS = Object.entries(MAINTENANCE_CATEGORY_LABELS) as [string, string][];

/**
 * Vista "Ver como inquilino": lista los contratos donde el usuario es inquilino
 * (o codeudor) y le permite REPORTAR UN DAÑO (mantenimiento) sin ser el dueño.
 */
export default function InquilinoPage() {
  const { user, loading } = useAuth();
  const [contracts, setContracts] = useState<TenantContract[] | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(CATS[0]?.[0] ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/me/tenant-contracts", { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; contracts?: TenantContract[] };
      setContracts(j.success ? (j.contracts ?? []) : []);
    } catch { setContracts([]); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  async function report(contractId: string) {
    if (!user) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.set("contractId", contractId);
      fd.set("title", title.trim());
      fd.set("description", desc.trim());
      fd.set("category", cat);
      if (photo) fd.set("photo", photo);
      const res = await fetch("/api/contracts/maintenance/create", {
        method: "POST",
        headers: { ...(await buildAuthHeaders(user)) },
        body: fd,
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (j.success) {
        setMsg("✅ Reporte enviado al dueño. Te avisaremos su respuesta.");
        setOpenFor(null); setTitle(""); setDesc(""); setPhoto(null);
      } else setMsg(j.errors?.[0]?.message ?? "No se pudo enviar el reporte.");
    } catch { setMsg("Error de red."); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="p-6 text-slate-500">Cargando…</p>;
  if (!user) return <p className="p-6 text-slate-500">Inicia sesión para ver tus arriendos como inquilino.</p>;

  return (
    <div className="relative min-h-screen bg-[#F5F3EF] text-[#17151F]">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/nuevo" className="text-sm font-semibold text-[#5646E5] hover:underline">← Inicio</Link>
          <Link href="/nuevo/contratos" className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#5646E5]">Ver como dueño →</Link>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Mis arriendos como inquilino</h1>
        <p className="mt-2 text-slate-500">Aquí puedes reportar daños y hacer seguimiento de los inmuebles que tienes en arriendo.</p>

        {msg && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}

        {contracts === null ? (
          <p className="mt-8 text-slate-400">Cargando…</p>
        ) : contracts.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white/70 p-8 text-center">
            <p className="text-lg font-semibold">Aún no apareces como inquilino en ningún contrato</p>
            <p className="mt-1 text-slate-500">Cuando un arrendador te incluya (con este correo), tu arriendo aparecerá aquí.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {contracts.map((c) => (
              <div key={c.contractId} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                <p className="text-lg font-bold">{c.address}</p>
                <p className="text-sm text-slate-500">{c.landlordName ? `Dueño: ${c.landlordName}` : ""}{c.role === "codebtor" ? " · (eres codeudor)" : ""}</p>
                <button
                  type="button"
                  onClick={() => { setOpenFor(openFor === c.contractId ? null : c.contractId); setMsg(""); }}
                  className="mt-3 rounded-xl bg-[#5646E5] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-105"
                >
                  🔧 Reportar un daño
                </button>

                {openFor === c.contractId && (
                  <div className="mt-4 space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ej. Fuga en el baño)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe el problema…" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      {CATS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                    <label className="block text-xs text-slate-600">
                      Foto (opcional)
                      <input type="file" accept="image/*,application/pdf" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
                    </label>
                    <button type="button" disabled={busy} onClick={() => void report(c.contractId)} className="w-full rounded-xl bg-[#12B886] px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-105 disabled:opacity-50">
                      {busy ? "Enviando…" : "Enviar reporte al dueño"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
