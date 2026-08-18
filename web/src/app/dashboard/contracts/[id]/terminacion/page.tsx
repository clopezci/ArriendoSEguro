"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { earlyTerminationPenaltyMonths, terminationLegalText, terminationTypeLabel, NOTICE_MONTHS, type LeasePhase, type TerminationType } from "@/domain/contracts/termination";

type Notice = {
  type: TerminationType;
  byRole: string;
  phase: LeasePhase;
  penaltyMonths: number;
  penaltyAmount: number;
  observation?: string;
  status: "notified" | "accepted" | "rejected";
  createdAt?: string;
  responseByRole?: string | null;
  responseObservation?: string | null;
  respondedAt?: string | null;
};
type Ctx = { viewerRole: string; canon: number; startDate: string; endDate: string; propertyAddress: string; notice: Notice | null };

const roleLabel = (r: string) => (r === "landlord" ? "El arrendador (dueño)" : "El arrendatario (inquilino)");

export default function TerminacionPage() {
  const id = String(useParams<{ id: string }>().id);
  const { user } = useAuth();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [phase, setPhase] = useState<LeasePhase>("initial");
  const [obs, setObs] = useState("");
  const [acc1, setAcc1] = useState(false);
  const [acc2, setAcc2] = useState(false);
  const [respObs, setRespObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch(`/api/contracts/termination/context?contractId=${encodeURIComponent(id)}`, { headers: { ...(await buildAuthHeaders(user)) } });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] } & Partial<Ctx>;
      if (!res.ok || !j.success) { setErr(j.errors?.[0]?.message ?? "No se pudo cargar."); return; }
      setCtx(j as Ctx);
    } catch { setErr("No se pudo conectar."); } finally { setLoading(false); }
  }, [id, user]);
  useEffect(() => { void load(); }, [load]);

  const earlyMonths = useMemo(() => (ctx ? earlyTerminationPenaltyMonths(ctx.viewerRole, phase) : 0), [ctx, phase]);
  const earlyAmount = ctx ? Math.round(ctx.canon * earlyMonths) : 0;

  async function notify(type: TerminationType) {
    if (!user || !ctx) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/contracts/termination/notify", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, type, phase, observation: obs, accepted1: acc1, accepted2: acc2 }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo registrar el aviso."); return; }
      await load();
    } catch { setMsg("Error de red."); } finally { setBusy(false); }
  }

  async function respond(accept: boolean) {
    if (!user) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/contracts/termination/respond", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, accept, observation: respObs }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo registrar la respuesta."); return; }
      await load();
    } catch { setMsg("Error de red."); } finally { setBusy(false); }
  }

  const n = ctx?.notice ?? null;
  const iAmNotifier = n && ctx && n.byRole === ctx.viewerRole;
  const iAmCounter = n && ctx && n.byRole !== ctx.viewerRole;

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <ExpedientePostWizardNav contractId={id} />
      <header className="space-y-2">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-[#17151F]">Avisar de NO renovación o terminación</h1>
        <p className="mt-2 text-slate-500">Registra el <b>aviso de no renovación</b> (fin de vigencia) o una <b>terminación anticipada</b>. Se deja constancia y se notifica a la otra parte para su respuesta.</p>
      </header>

      {loading && <p className="text-sm text-slate-600">Cargando…</p>}
      {err && <p className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}

      {!loading && ctx && (
        <>
          {/* Estado si ya hay un aviso. */}
          {n && (
            <section className={`rounded-3xl border-2 p-5 ${n.status === "accepted" ? "border-emerald-400 bg-emerald-50" : n.status === "rejected" ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50"}`}>
              <p className="text-lg font-bold text-slate-900">{terminationTypeLabel(n.type)} registrado</p>
              <p className="mt-1 text-sm text-slate-700">Por: <b>{roleLabel(n.byRole)}</b>. {n.penaltyMonths > 0 ? `Indemnización estimada: $${n.penaltyAmount.toLocaleString("es-CO")} (${n.penaltyMonths} meses de canon).` : "Sin indemnización (no renovación en término)."}</p>
              {n.observation && <p className="mt-1 text-sm text-slate-700"><b>Observación:</b> {n.observation}</p>}
              <p className="mt-1 text-sm font-semibold">
                Estado: {n.status === "accepted" ? "✓ Aceptado por la otra parte" : n.status === "rejected" ? "✗ No aceptado por la otra parte" : "Esperando respuesta de la otra parte"}
              </p>
              {n.responseObservation && <p className="mt-1 text-sm text-slate-700"><b>Respuesta:</b> {n.responseObservation}</p>}

              {/* La contraparte responde. */}
              {iAmCounter && n.status === "notified" && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Tu respuesta</p>
                  <textarea value={respObs} onChange={(e) => setRespObs(e.target.value)} rows={3} placeholder="Observación (opcional)" className="mt-2 w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void respond(true)} disabled={busy} className="rounded-xl bg-[#12B886] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Aceptar</button>
                    <button type="button" onClick={() => void respond(false)} disabled={busy} className="rounded-xl border-2 border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-60">No acepto</button>
                  </div>
                </div>
              )}
              {iAmNotifier && n.status === "notified" && <p className="mt-2 text-xs text-slate-500">Notificamos a la otra parte; te avisaremos cuando responda.</p>}
            </section>
          )}

          {/* Registrar un aviso nuevo (si no hay uno activo). */}
          {!n && (
            <>
              {/* No renovación */}
              <section className="rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">No renovar (fin de vigencia)</h2>
                <ul className="mt-2 space-y-1 pl-4 text-xs text-slate-600 [list-style:disc]">
                  {terminationLegalText({ type: "non_renewal", byRole: ctx.viewerRole, phase, monthlyRent: ctx.canon, penaltyMonths: 0 }).map((l, i) => <li key={i}>{l}</li>)}
                </ul>
                <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Observación para la otra parte (opcional)" className="mt-3 w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]" />
                <button type="button" onClick={() => void notify("non_renewal")} disabled={busy} className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Registrando…" : "Registrar aviso de NO renovación"}</button>
              </section>

              {/* Terminación anticipada */}
              <section className="rounded-3xl border-2 border-rose-200 bg-rose-50/50 p-5 shadow-sm">
                <h2 className="text-lg font-bold text-rose-900">Terminación anticipada (antes del vencimiento)</h2>
                <p className="mt-1 text-xs text-slate-600">Elige la etapa del contrato para calcular la penalización (Ley 820 de 2003):</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPhase("initial")} className={`rounded-xl border-2 px-3 py-1.5 text-xs font-bold ${phase === "initial" ? "border-[#5646E5] bg-[#ECE9FB]/60 text-[#5646E5]" : "border-slate-200 text-slate-700"}`}>Vigencia inicial</button>
                  <button type="button" onClick={() => setPhase("renewal")} className={`rounded-xl border-2 px-3 py-1.5 text-xs font-bold ${phase === "renewal" ? "border-[#5646E5] bg-[#ECE9FB]/60 text-[#5646E5]" : "border-slate-200 text-slate-700"}`}>Durante una prórroga</button>
                </div>
                <ul className="mt-3 space-y-1 pl-4 text-xs text-slate-700 [list-style:disc]">
                  {terminationLegalText({ type: "early", byRole: ctx.viewerRole, phase, monthlyRent: ctx.canon, penaltyMonths: earlyMonths }).map((l, i) => <li key={i}>{l}</li>)}
                </ul>
                <div className="mt-3 rounded-2xl border-2 border-rose-300 bg-white p-3">
                  <p className="text-sm font-bold text-rose-900">Indemnización estimada: ${earlyAmount.toLocaleString("es-CO")} ({earlyMonths} meses de canon)</p>
                  <label className="mt-2 flex items-start gap-2 text-xs text-slate-800">
                    <input type="checkbox" checked={acc1} onChange={(e) => setAcc1(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
                    <span>Reconozco que la terminación anticipada genera una <b>indemnización de ${earlyAmount.toLocaleString("es-CO")}</b> ({earlyMonths} meses de canon).</span>
                  </label>
                  <label className="mt-2 flex items-start gap-2 text-xs text-slate-800">
                    <input type="checkbox" checked={acc2} onChange={(e) => setAcc2(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
                    <span>Entiendo que debo dar el <b>preaviso de {NOTICE_MONTHS} meses</b> y que ArriendoSeguro solo deja constancia; no sustituye asesoría legal.</span>
                  </label>
                </div>
                <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Observación para la otra parte (opcional)" className="mt-3 w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]" />
                <button type="button" onClick={() => void notify("early")} disabled={busy || !acc1 || !acc2} className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? "Registrando…" : "Registrar terminación anticipada"}</button>
              </section>
            </>
          )}

          {msg && <p className="rounded-lg border border-slate-200 bg-white/80 p-2 text-sm text-slate-800">{msg}</p>}
          <p className="text-[11px] leading-relaxed text-slate-500">Información orientativa (Ley 820 de 2003). ArriendoSeguro deja constancia con fecha y evidencia; no decide ni sustituye asesoría legal.</p>
        </>
      )}
    </main>
  );
}
