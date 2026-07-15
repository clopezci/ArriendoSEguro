"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useSavedContract } from "@/components/contracts/requires-saved-contract";

/**
 * "Termina tu contrato": lo que falta ANTES de dar el contrato por completo, en
 * bento PASO A PASO (una cosa a la vez, con Atrás/Continuar). Solo tres puntos:
 *   1) Documentos pendientes (propiedad / poder).
 *   2) Condiciones de pago (método, cuenta/QR y días de aviso).
 *   3) Alertas y notificaciones (aviso de vencimiento/renovación).
 * Reutiliza las MISMAS páginas/endpoints; aquí solo guía y muestra qué falta.
 * Lo posterior (acta, inventario, gestión) vive en «Administra tu arriendo».
 */
type StepKey = "documentos" | "pago" | "alertas";
type St = "loading" | "done" | "pending";

const STEPS: { key: StepKey; label: string; icon: string; title: string; desc: string; slug: string }[] = [
  { key: "documentos", label: "Documentos", icon: "📄", title: "Documentos de propiedad / poder", desc: "Sube los documentos que soportan la propiedad y, si eres apoderado, el poder. Solo lo que falte.", slug: "documentos-propiedad" },
  { key: "pago", label: "Pagos", icon: "🔔", title: "Condiciones de pago", desc: "Elige método (transferencia/efectivo/otro), deja cuenta o QR y los días de aviso. El QR/cuenta se envía en el recordatorio.", slug: "pagos-recordatorios" },
  { key: "alertas", label: "Alertas", icon: "⏰", title: "Alertas y notificaciones", desc: "Configura el aviso de vencimiento y renovación para no quedarte sin plazo.", slug: "alertas" },
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
  const [status, setStatus] = useState<Record<StepKey, St>>({ documentos: "loading", pago: "loading", alertas: "loading" });

  const refresh = useCallback(async () => {
    if (!saved || !versionId) return;
    const vq = `contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`;
    const set = (k: StepKey, ok: boolean) => setStatus((s) => ({ ...s, [k]: ok ? "done" : "pending" }));
    const authH = user ? await buildAuthHeaders(user) : {};
    fetch(`/api/contracts/property-documents/list?${vq}`, { headers: { ...authH } })
      .then((r) => r.json()).then((j) => set("documentos", Array.isArray(j?.documents) && j.documents.length > 0)).catch(() => set("documentos", false));
    fetch(`/api/contracts/payment-settings?contractId=${encodeURIComponent(id)}`, { headers: { ...authH } })
      .then((r) => r.json()).then((j) => set("pago", Boolean(j?.settings && j.settings.method && j.settings.method !== "none"))).catch(() => set("pago", false));
    fetch(`/api/contracts/renewal-reminder?contractId=${encodeURIComponent(id)}`, { headers: { ...authH } })
      .then((r) => r.json()).then((j) => set("alertas", Boolean(j?.reminder?.enabled))).catch(() => set("alertas", false));
  }, [saved, versionId, id, user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const order = STEPS.map((s) => s.key);
  const goNext = () => setActive(order[Math.min(order.indexOf(active) + 1, order.length - 1)]);
  const goPrev = () => setActive(order[Math.max(order.indexOf(active) - 1, 0)]);
  const doneCount = order.filter((k) => status[k] === "done").length;
  const current = STEPS.find((s) => s.key === active)!;
  const st = status[active];

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
        <p className="mt-3 text-lg text-slate-500">Completa lo que falta, <b>una cosa a la vez</b>.</p>

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
                  const done = status[s.key] === "done";
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
                    {st === "loading" ? <span className="text-[11px] text-slate-400">…</span>
                      : st === "done" ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Hecho</span>
                      : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pendiente</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{current.desc}</p>
                </div>
              </div>
              <button
                onClick={() => router.push(`/dashboard/contracts/${id}/${current.slug}`)}
                className="mt-4 w-full rounded-2xl bg-[#5646E5] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-105 active:scale-95"
              >
                {st === "done" ? "Revisar / ajustar →" : "Configurar ahora →"}
              </button>
            </motion.section>

            {/* Navegación */}
            <div className="mt-6 flex items-center justify-between gap-2">
              {active !== order[0] ? (
                <button onClick={goPrev} className="rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-[#5646E5] hover:text-[#5646E5]">← Atrás</button>
              ) : <span />}
              {active !== order[order.length - 1] ? (
                <button onClick={goNext} className="rounded-2xl bg-[#FF6B4A] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:brightness-105 active:scale-95">Continuar →</button>
              ) : (
                <button onClick={() => router.push(`/nuevo/gestionar/${id}`)} className="rounded-2xl bg-[#12B886] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-105 active:scale-95">Administra tu arriendo →</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
