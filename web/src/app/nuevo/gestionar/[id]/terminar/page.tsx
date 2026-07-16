"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useSavedContract } from "@/components/contracts/requires-saved-contract";

/**
 * "Termina tu contrato": lo que falta ANTES de dar el contrato por completo, en
 * bento PASO A PASO (una cosa a la vez, con Atrás/Continuar). Tres puntos:
 *   1) Documentos (propiedad / poder / de las partes).
 *   2) Condiciones de pago (método, cuenta/QR y días de aviso).
 *   3) Alertas y notificaciones (aviso de vencimiento/renovación).
 * El DUEÑO es el responsable: revisa cada punto y lo CONFIRMA (listo o no aplica).
 * Solo cuando confirma los tres se habilita «Administra tu arriendo».
 * Reutiliza las MISMAS páginas/endpoints; aquí solo guía, detecta y confirma.
 */
type StepKey = "documentos" | "pago" | "alertas";

type StepDef = {
  key: StepKey;
  label: string;
  icon: string;
  title: string;
  desc: string;
  slug: string;
  tips: string[];
  /** Texto del "ya lo hiciste" cuando detectamos configuración real. */
  signalDone: string;
};

const STEPS: StepDef[] = [
  {
    key: "documentos",
    label: "Documentos",
    icon: "📄",
    title: "Documentos del contrato",
    desc: "Revisa que estén los documentos que respaldan el contrato. Súbelos o, si no aplican, márcalo como listo.",
    slug: "documentos-propiedad",
    tips: [
      "Documento que soporta la propiedad (certificado de tradición, predial, escritura o servicios).",
      "Si actúas como apoderado, el poder autenticado que te faculta para arrendar.",
      "Documentos de cada parte (cédula, carta laboral, colillas). Si falta alguno, pídele a esa parte que lo suba desde su enlace de invitación.",
    ],
    signalDone: "Detectamos documentos ya subidos en este contrato.",
  },
  {
    key: "pago",
    label: "Pagos",
    icon: "🔔",
    title: "Condiciones de pago",
    desc: "Elige cómo te paga el inquilino y deja cuenta o QR; con esto enviamos los recordatorios.",
    slug: "pagos-recordatorios",
    tips: [
      "Método: transferencia, efectivo u otro.",
      "Cuenta o QR (se envía junto con el recordatorio al inquilino).",
      "Días de aviso antes del vencimiento.",
    ],
    signalDone: "Ya dejaste configurado un método de pago.",
  },
  {
    key: "alertas",
    label: "Alertas",
    icon: "⏰",
    title: "Alertas y notificaciones",
    desc: "Activa el aviso de vencimiento y renovación para no quedarte sin plazo (preaviso de 3 meses).",
    slug: "alertas",
    tips: [
      "Aviso de vencimiento/renovación a ambas partes.",
      "Respeta el preaviso legal de 3 meses (Ley 820).",
    ],
    signalDone: "Ya tienes activadas las alertas de vencimiento.",
  },
];

export default function TerminarContratoPage() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  const { user } = useAuth();
  const sc = useSavedContract(id);
  const saved = sc.status === "saved";
  const unlocked = saved || sc.status === "error";
  const versionId = sc.currentVersionId ?? "";

  const [active, setActive] = useState<StepKey>("documentos");
  // Señal de configuración real detectada (ayuda visual, no es el candado).
  const [signal, setSignal] = useState<Record<StepKey, boolean>>({ documentos: false, pago: false, alertas: false });
  // Confirmación del dueño (el candado real): listo / no aplica.
  const [ack, setAck] = useState<Record<StepKey, boolean>>({ documentos: false, pago: false, alertas: false });
  const [savingAck, setSavingAck] = useState<StepKey | null>(null);

  const refresh = useCallback(async () => {
    if (!saved) return;
    const authH = user ? await buildAuthHeaders(user) : {};
    const setSig = (k: StepKey, ok: boolean) => setSignal((s) => ({ ...s, [k]: ok }));

    // Documentos: pueden vivir en el borrador (draft_property_docs, subidos en el
    // flujo inicial) O post-guardado (property_documents). Cualquiera cuenta.
    void (async () => {
      let found = false;
      try {
        const r = await fetch(`/api/contracts/draft-property-docs/list?contractDraftId=${encodeURIComponent(id)}`, { headers: { ...authH } });
        const j = await r.json();
        found = Array.isArray(j?.docs) && j.docs.length > 0;
      } catch { /* noop */ }
      if (!found && versionId) {
        try {
          const r = await fetch(`/api/contracts/property-documents/list?contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`, { headers: { ...authH } });
          const j = await r.json();
          found = Array.isArray(j?.documents) && j.documents.length > 0;
        } catch { /* noop */ }
      }
      setSig("documentos", found);
    })();

    fetch(`/api/contracts/payment-settings?contractId=${encodeURIComponent(id)}`, { headers: { ...authH } })
      .then((r) => r.json()).then((j) => setSig("pago", Boolean(j?.settings && j.settings.method && j.settings.method !== "none"))).catch(() => setSig("pago", false));
    fetch(`/api/contracts/renewal-reminder?contractId=${encodeURIComponent(id)}`, { headers: { ...authH } })
      .then((r) => r.json()).then((j) => setSig("alertas", Boolean(j?.enabled ?? j?.reminder?.enabled))).catch(() => setSig("alertas", false));

    // Confirmaciones del dueño (candado real).
    try {
      const r = await fetch(`/api/contracts/termination-checklist?contractId=${encodeURIComponent(id)}`, { headers: { ...authH } });
      const j = await r.json();
      if (j?.success && j.checklist) setAck({ documentos: !!j.checklist.documentos, pago: !!j.checklist.pago, alertas: !!j.checklist.alertas });
    } catch { /* noop */ }
  }, [saved, versionId, id, user]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function toggleAck(step: StepKey, value: boolean) {
    if (!user) return;
    setAck((s) => ({ ...s, [step]: value })); // optimista
    setSavingAck(step);
    try {
      const res = await fetch("/api/contracts/termination-checklist", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await buildAuthHeaders(user)) },
        body: JSON.stringify({ contractId: id, step, value }),
      });
      const j = await res.json();
      if (j?.success && j.checklist) setAck({ documentos: !!j.checklist.documentos, pago: !!j.checklist.pago, alertas: !!j.checklist.alertas });
      else setAck((s) => ({ ...s, [step]: !value })); // revertir si falló
    } catch {
      setAck((s) => ({ ...s, [step]: !value }));
    } finally {
      setSavingAck(null);
    }
  }

  const order = STEPS.map((s) => s.key);
  const goNext = () => setActive(order[Math.min(order.indexOf(active) + 1, order.length - 1)]);
  const goPrev = () => setActive(order[Math.max(order.indexOf(active) - 1, 0)]);
  const doneCount = order.filter((k) => ack[k]).length;
  const allDone = doneCount === STEPS.length;
  const current = STEPS.find((s) => s.key === active)!;
  const isDone = ack[active];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#37D0E8,#3A7BFF)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => router.push(`/dashboard/contracts/${id}/preview`)} className="flex items-center gap-2 text-sm font-semibold text-[#5646E5] hover:underline">← Al contrato</button>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Termina tu contrato</span>
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-none tracking-tight">Termina tu contrato</h1>
        <p className="mt-3 text-lg text-slate-500">Revisa y confirma cada punto, <b>una cosa a la vez</b>. Tú decides el orden.</p>

        {!unlocked && (
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-center">
            <p className="text-lg font-bold text-slate-900">Primero guarda tu contrato</p>
            <p className="mt-1 text-slate-600">Termina y guarda tu contrato en la vista previa y vuelve aquí.</p>
            <button onClick={() => router.push(`/dashboard/contracts/${id}/preview`)} className="mt-4 rounded-2xl bg-[#FF6B4A] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95">Ir a la vista previa →</button>
          </div>
        )}

        {unlocked && (
          <>
            {/* Sub-stepper */}
            <div className="mt-6 rounded-3xl border-2 border-[#5646E5]/15 bg-[#ECE9FB]/40 p-3">
              <div className="flex items-start gap-1">
                {STEPS.map((s, i) => {
                  const done = ack[s.key];
                  const isActive = active === s.key;
                  return (
                    <button key={s.key} type="button" onClick={() => setActive(s.key)} className="flex flex-1 flex-col items-center gap-1 text-center">
                      <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-[#12B886] text-white" : isActive ? "bg-[#5646E5] text-white" : "bg-white text-slate-400 ring-1 ring-slate-200"}`}>{done ? "✓" : i + 1}</span>
                      <span className={`text-[11px] font-semibold ${isActive ? "text-[#5646E5]" : done ? "text-[#0B6E4E]" : "text-slate-400"}`}>{s.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
                <div className="h-full rounded-full bg-gradient-to-r from-[#5646E5] to-[#12B886] transition-all" style={{ width: `${Math.round((doneCount / STEPS.length) * 100)}%` }} />
              </div>
            </div>

            {/* Sección activa */}
            <motion.section key={active} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="mt-5 rounded-3xl border-2 border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[#ECE9FB] text-2xl">{current.icon}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{current.title}</h2>
                    {isDone
                      ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Confirmado</span>
                      : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Por confirmar</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{current.desc}</p>
                </div>
              </div>

              {/* Tips para que el dueño evalúe */}
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
                <p className="text-xs font-bold text-sky-800">Antes de confirmar, revisa:</p>
                <ul className="mt-1.5 space-y-1">
                  {current.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-xs text-slate-700"><span aria-hidden="true">•</span><span>{t}</span></li>
                  ))}
                </ul>
              </div>

              {signal[active] && (
                <p className="mt-3 text-xs font-medium text-emerald-700">✓ {current.signalDone}</p>
              )}

              <button
                onClick={() => router.push(`/dashboard/contracts/${id}/${current.slug}?from=terminar`)}
                className="mt-4 w-full rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95"
              >
                {signal[active] ? "Revisar / ajustar →" : "Configurar ahora →"}
              </button>

              {/* Confirmación del dueño = candado real */}
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-2xl border-2 border-slate-200 bg-white p-3 text-sm text-slate-700 transition hover:border-[#12B886]">
                <input
                  type="checkbox"
                  checked={isDone}
                  disabled={savingAck === active}
                  onChange={(e) => void toggleAck(active, e.target.checked)}
                  className="mt-0.5 h-5 w-5 flex-none accent-[#12B886]"
                />
                <span>
                  <b>Confirmo que este punto está listo</b> (lo configuré/subí) <b>o que no aplica</b> para este contrato.
                  {savingAck === active && <span className="ml-1 text-xs text-slate-400">guardando…</span>}
                </span>
              </label>
            </motion.section>

            {/* Navegación */}
            <div className="mt-6 flex items-center justify-between gap-2">
              {active !== order[0] ? (
                <button onClick={goPrev} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5]">← Atrás</button>
              ) : <span />}
              {active !== order[order.length - 1] ? (
                <button onClick={goNext} className="rounded-2xl bg-[#FF6B4A] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 active:scale-95">Continuar →</button>
              ) : (
                <span />
              )}
            </div>

            {/* Cierre: solo cuando los 3 puntos están confirmados */}
            <div className="mt-6 rounded-3xl border-2 border-slate-200 bg-white/90 p-5 text-center shadow-sm">
              {allDone ? (
                <>
                  <p className="text-lg font-bold text-[#0B6E4E]">¡Todo confirmado! 🎉</p>
                  <p className="mt-1 text-sm text-slate-600">Tu contrato quedó terminado. Ya puedes administrarlo día a día.</p>
                  <button onClick={() => router.push(`/nuevo/gestionar/${id}`)} className="mt-4 rounded-2xl bg-[#12B886] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95">Administra tu arriendo →</button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-700">Te faltan {STEPS.length - doneCount} de {STEPS.length} por confirmar</p>
                  <p className="mt-1 text-xs text-slate-500">Cuando confirmes los tres puntos se habilita <b>Administra tu arriendo</b>. Aún no puedes administrar un contrato que no has terminado.</p>
                  <button disabled className="mt-4 cursor-not-allowed rounded-2xl bg-slate-200 px-7 py-3 text-sm font-bold text-slate-400">Administra tu arriendo →</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
