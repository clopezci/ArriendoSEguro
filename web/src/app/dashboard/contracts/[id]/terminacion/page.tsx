"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ExpedientePostWizardNav } from "@/components/contracts/expediente-post-wizard-nav";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { earlyTerminationPenaltyMonths, terminationLegalText, terminationTypeLabel, NOTICE_MONTHS, TERMINATION_ACK, type LeasePhase, type TerminationType } from "@/domain/contracts/termination";

type Acceptance = { effectiveDate?: string; penaltyAmountAgreed?: number; paymentMethod?: string; acknowledged?: boolean; byRole?: string; at?: string };
type PaymentTrace = { status?: "pending" | "paid" | "unpaid"; updatedAt?: string | null; note?: string };
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
  acceptance?: Acceptance | null;
  paymentTrace?: PaymentTrace | null;
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
  // Formulario de aceptación de la parte afectada (acreedora).
  const [effectiveDate, setEffectiveDate] = useState("");
  const [agreedAmount, setAgreedAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [ackResp, setAckResp] = useState(false);
  // Trazabilidad del pago.
  const [payNote, setPayNote] = useState("");
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

  // Prefill del monto acordado con el MÁXIMO legal del aviso (la contraparte puede bajarlo).
  useEffect(() => {
    const nn = ctx?.notice;
    if (nn && nn.status === "notified" && nn.type === "early" && (nn.penaltyAmount ?? 0) > 0 && !agreedAmount) {
      setAgreedAmount(String(nn.penaltyAmount));
    }
  }, [ctx, agreedAmount]);

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
    const nn = ctx?.notice;
    const isEarly = nn?.type === "early" && (nn?.penaltyAmount ?? 0) > 0;
    // Al aceptar una terminación anticipada con indemnización, exigimos el formulario.
    if (accept && isEarly) {
      if (!effectiveDate) { setMsg("Indica a partir de qué fecha aceptas la terminación."); return; }
      if (!ackResp) { setMsg("Debes aceptar la declaración final para continuar."); return; }
    }
    const amountNum = Math.round(Number((agreedAmount || "").replace(/[^\d]/g, "")) || 0);
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/contracts/termination/respond", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({
          contractId: id, accept, observation: respObs,
          effectiveDate: accept ? effectiveDate : "",
          penaltyAmountAgreed: accept ? amountNum : 0,
          paymentMethod: accept ? payMethod : "",
          acknowledged: accept ? ackResp : false,
        }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo registrar la respuesta."); return; }
      await load();
    } catch { setMsg("Error de red."); } finally { setBusy(false); }
  }

  async function markPaid(paid: boolean) {
    if (!user) return;
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/contracts/termination/payment-status", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, paid, note: payNote }),
      });
      const j = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
      if (!res.ok || !j.success) { setMsg(j.errors?.[0]?.message ?? "No se pudo registrar el estado del pago."); return; }
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

                  {/* Terminación anticipada con indemnización → formulario de aceptación. */}
                  {n.type === "early" && n.penaltyAmount > 0 && (
                    <div className="mt-2 space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
                      <p className="text-xs text-slate-700">Si <b>aceptas</b>, define las condiciones. Tú eres la parte que <b>recibe</b> la indemnización.</p>
                      <label className="block text-xs font-semibold text-slate-800">
                        A partir de qué fecha aceptas la terminación
                        <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="mt-1 block w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]" />
                      </label>
                      <label className="block text-xs font-semibold text-slate-800">
                        Valor de la indemnización a cobrar (máximo legal: ${n.penaltyAmount.toLocaleString("es-CO")})
                        <input inputMode="numeric" value={agreedAmount} onChange={(e) => setAgreedAmount(e.target.value.replace(/[^\d]/g, ""))} className="mt-1 block w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]" />
                        {Number(agreedAmount || 0) > n.penaltyAmount && <span className="mt-1 block text-[11px] font-bold text-rose-600">No puede superar el máximo legal.</span>}
                      </label>
                      <label className="block text-xs font-semibold text-slate-800">
                        Medio de pago con el que recibirás (cuenta, Nequi, etc.)
                        <input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="Ej.: Bancolimbia ahorros 123-456, o Nequi 300…" className="mt-1 block w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]" />
                      </label>
                      <label className="flex items-start gap-2 text-[11px] text-slate-800">
                        <input type="checkbox" checked={ackResp} onChange={(e) => setAckResp(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rose-600" />
                        <span>{TERMINATION_ACK.intermediation}</span>
                      </label>
                      <a href="/legal/terminos" target="_blank" rel="noopener noreferrer" className="block text-[11px] font-semibold text-[#5646E5] underline">Ver Términos y Condiciones (§8B)</a>
                    </div>
                  )}

                  <textarea value={respObs} onChange={(e) => setRespObs(e.target.value)} rows={3} placeholder="Observación (opcional)" className="mt-2 w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]" />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void respond(true)} disabled={busy || (n.type === "early" && n.penaltyAmount > 0 && Number(agreedAmount || 0) > n.penaltyAmount)} className="rounded-xl bg-[#12B886] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Aceptar</button>
                    <button type="button" onClick={() => void respond(false)} disabled={busy} className="rounded-xl border-2 border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-60">No acepto</button>
                  </div>
                </div>
              )}
              {iAmNotifier && n.status === "notified" && <p className="mt-2 text-xs text-slate-500">Notificamos a la otra parte; te avisaremos cuando responda.</p>}

              {/* Condiciones acordadas (tras aceptar). */}
              {n.status === "accepted" && n.acceptance && (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-3 text-sm text-slate-700">
                  <p className="font-semibold text-emerald-800">Condiciones acordadas</p>
                  {n.acceptance.effectiveDate && <p className="mt-1">Termina a partir de: <b>{n.acceptance.effectiveDate}</b>.</p>}
                  <p className="mt-1">{(n.acceptance.penaltyAmountAgreed ?? 0) > 0 ? <>Indemnización: <b>${(n.acceptance.penaltyAmountAgreed ?? 0).toLocaleString("es-CO")}</b>.</> : "Sin indemnización."}</p>
                  {n.acceptance.paymentMethod && <p className="mt-1">Medio de pago para recibir: <b>{n.acceptance.paymentMethod}</b>.</p>}
                  <p className="mt-2 text-[11px] text-slate-500">ArriendoSeguro solo deja constancia de esta comunicación. El pago lo hacen directamente entre ustedes.</p>
                </div>
              )}

              {/* Trazabilidad del pago: solo la parte que RECIBE (quien aceptó) la marca. */}
              {n.status === "accepted" && n.acceptance && (n.acceptance.penaltyAmountAgreed ?? 0) > 0 && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Estado del pago</p>
                  <p className="mt-1 text-sm">
                    {n.paymentTrace?.status === "paid" ? "✓ La parte que recibe confirmó que le pagaron." : n.paymentTrace?.status === "unpaid" ? "⏳ Aún no le han pagado." : "Sin registrar todavía."}
                    {n.paymentTrace?.note ? ` — ${n.paymentTrace.note}` : ""}
                  </p>
                  {n.acceptance.byRole === ctx.viewerRole ? (
                    <div className="mt-2">
                      <textarea value={payNote} onChange={(e) => setPayNote(e.target.value)} rows={2} placeholder="Nota (opcional)" className="w-full rounded-xl border-2 border-slate-200 p-2 text-sm outline-none focus:border-[#5646E5]" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void markPaid(true)} disabled={busy} className="rounded-xl bg-[#12B886] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">✓ Ya me pagaron</button>
                        <button type="button" onClick={() => void markPaid(false)} disabled={busy} className="rounded-xl border-2 border-amber-300 px-4 py-2 text-sm font-bold text-amber-700 disabled:opacity-60">Aún no me pagan</button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">Solo la parte que recibe el pago puede actualizar este estado.</p>
                  )}
                </div>
              )}
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
