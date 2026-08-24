"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { FileButton } from "@/components/ui/file-button";
import { MAINTENANCE_CATEGORY_LABELS } from "@/domain/maintenance/maintenance";

type TenantContract = { contractId: string; address: string; landlordName: string; role: "tenant" | "codebtor" };
const CATS = Object.entries(MAINTENANCE_CATEGORY_LABELS) as [string, string][];

/**
 * Hub del INQUILINO: lista los contratos donde el usuario es inquilino (o
 * codeudor) y, por cada uno, le da acceso a TODAS sus opciones (reparaciones y
 * solicitudes, otras novedades, calificar/refutar), además del reporte rápido de
 * un daño. Reusa las páginas existentes, que ya validan por rol de participante.
 */
export default function InquilinoPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [contracts, setContracts] = useState<TenantContract[] | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(CATS[0]?.[0] ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pazBusyFor, setPazBusyFor] = useState<string | null>(null);
  const [pazSentFor, setPazSentFor] = useState<string | null>(null);

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

  async function requestPaz(contractId: string) {
    if (!user) return;
    setPazBusyFor(contractId); setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/contracts/paz-y-salvo/request-auth", {
        method: "POST", headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      const ok = res.ok && Boolean(j.success);
      setMsg(ok ? "✅ Solicitud enviada a tu arrendador (paz y salvo, recomendación y acta)." : (j.errors?.[0]?.message ?? "No se pudo enviar la solicitud."));
      if (ok) { setPazSentFor(contractId); setTimeout(() => setPazSentFor((cur) => (cur === contractId ? null : cur)), 6000); }
    } catch { setMsg("Error de red."); } finally { setBusy(false); setPazBusyFor(null); }
  }

  const actions = (c: TenantContract): Array<{ icon: string; label: string; sub: string; href: string }> => [
    { icon: "💳", label: "Mis pagos", sub: "Registra tu pago del mes con comprobante y ve el calendario.", href: `/inquilino/${c.contractId}/pagos` },
    { icon: "🔧", label: "Reparaciones y solicitudes", sub: "Reporta daños o pide algo al dueño y sigue las respuestas.", href: `/dashboard/contracts/${c.contractId}/mantenimiento` },
    { icon: "🗒️", label: "Otras novedades", sub: "Deja constancia de acuerdos, avisos o incidencias.", href: `/dashboard/contracts/${c.contractId}/novedades` },
    { icon: "⭐", label: "Calificar / refutar", sub: "Califica tu experiencia o responde una calificación recibida.", href: `/dashboard/contracts/${c.contractId}/reputacion` },
    { icon: "📄", label: "Avisar NO renovación / terminación", sub: "Registra el aviso de no renovar o terminar, con constancia.", href: `/dashboard/contracts/${c.contractId}/terminacion` },
  ];

  return (
    <div className="relative min-h-screen bg-[#F5F3EF] text-[#17151F]">
      <div className="mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/nuevo" className="text-sm font-semibold text-[#5646E5] hover:underline">← Inicio</Link>
          <Link href="/nuevo/contratos" className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#5646E5]">Ver como dueño →</Link>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Administra mis arriendos</h1>
        <p className="mt-2 text-slate-500">Estos son los inmuebles que tienes en arriendo. Elige uno y gestiona tus opciones como inquilino.</p>

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
              <div key={c.contractId} className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
                <p className="text-lg font-bold">{c.address || "Tu arriendo"}</p>
                <p className="text-sm text-slate-500">{c.landlordName ? `Dueño: ${c.landlordName}` : ""}{c.role === "codebtor" ? " · (eres codeudor)" : ""}</p>

                {/* Opciones del inquilino para este contrato. */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {actions(c).map((a) => (
                    <button
                      key={a.href}
                      type="button"
                      onClick={() => router.push(a.href)}
                      className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left transition hover:border-[#5646E5] active:scale-[0.99]"
                    >
                      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#ECE9FB] text-lg">{a.icon}</span>
                      <span className="min-w-0">
                        <b className="text-sm">{a.label}</b>
                        <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{a.sub}</span>
                      </span>
                    </button>
                  ))}
                  {/* Solicitar cierre: paz y salvo + recomendación + acta. */}
                  <button
                    type="button"
                    disabled={pazBusyFor === c.contractId}
                    onClick={() => void requestPaz(c.contractId)}
                    className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left transition hover:border-[#5646E5] active:scale-[0.99] disabled:opacity-60"
                  >
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#ECE9FB] text-lg">🧾</span>
                    <span className="min-w-0">
                      <b className="text-sm">Solicitar paz y salvo</b>
                      <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">Al terminar: pídele al dueño tu paz y salvo, recomendación y acta.</span>
                      {pazBusyFor === c.contractId && <span className="mt-1 block text-[12px] font-bold text-slate-500">Enviando…</span>}
                      {pazSentFor === c.contractId && <span className="mt-1 block rounded-lg bg-emerald-50 px-2 py-1 text-[12px] font-bold text-emerald-700">✓ ¡Solicitud enviada al dueño!</span>}
                    </span>
                  </button>
                  {/* Reporte rápido de daño (inline). */}
                  <button
                    type="button"
                    onClick={() => { setOpenFor(openFor === c.contractId ? null : c.contractId); setMsg(""); }}
                    className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left transition hover:border-[#12B886] active:scale-[0.99]"
                  >
                    <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#E9F9F1] text-lg">⚡</span>
                    <span className="min-w-0">
                      <b className="text-sm">Reporte rápido de daño</b>
                      <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">Envía un daño al dueño sin salir de aquí.</span>
                    </span>
                  </button>
                </div>

                {openFor === c.contractId && (
                  <div className="mt-4 space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ej. Fuga en el baño)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe el problema…" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      {CATS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                    <div className="text-xs text-slate-600">
                      <span className="block">Foto (opcional)</span>
                      <div className="mt-1"><FileButton file={photo} onFile={setPhoto} accept="image/*,application/pdf" label="Elegir foto" /></div>
                    </div>
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
