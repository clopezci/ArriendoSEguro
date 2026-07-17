"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import { useSavedContract } from "@/components/contracts/requires-saved-contract";
import { getDraft, type ContractDraft } from "@/features/contracts/wizard-state";

/**
 * Paso 7 del rediseño: la POSVENTA como recorrido "una cosa a la vez" con menú.
 * Reutiliza los MISMOS módulos y endpoints del hub de producción (`adicionales`)
 * —así todo lo funcional aplica igual— pero presentado en tarjetas grandes y
 * claras: el usuario entra, ve qué ya está hecho y elige UNA acción a la vez.
 * Se habilita solo cuando el contrato está guardado.
 */

type StatusKey = "documentos" | "pago" | "calendario" | "entrega" | "notaria";
type ItemStatus = "loading" | "done" | "pending" | "none";

type Action = {
  slug: string;
  title: string;
  desc: string;
  icon: string;
  phase: "Entrega" | "Durante el arriendo" | "Cierre";
  statusKey?: StatusKey;
  optional?: boolean;
};

// Aquí SOLO va la gestión POSTERIOR al contrato completo. Lo de "terminar de
// configurar" (documentos, condiciones de pago, alertas) vive en el flujo
// «Termina tu contrato» (/terminar) para no mezclar.
const ACTIONS: Action[] = [
  { slug: "inventory", title: "Inventario y acta de entrega", desc: "Registra el estado por zonas con fotos y genera el acta.", icon: "📦", phase: "Entrega", statusKey: "entrega" },
  { slug: "notarial", title: "Autenticación notarial", desc: "Opcional: sube el PDF autenticado como refuerzo.", icon: "🏛️", phase: "Entrega", statusKey: "notaria", optional: true },
  { slug: "payment-schedule", title: "Ver calendario de pagos", desc: "Se genera al configurar tus pagos. Aquí lo consultas.", icon: "🗓️", phase: "Durante el arriendo", statusKey: "calendario", optional: true },
  { slug: "payments", title: "Registro de pagos", desc: "Confirma pagos, genera anexos y el enlace para el inquilino.", icon: "✅", phase: "Durante el arriendo" },
  { slug: "mantenimiento", title: "Reparaciones", desc: "El inquilino reporta un arreglo; el dueño acepta o rechaza. Si hay disputa, un abogado aliado.", icon: "🔧", phase: "Durante el arriendo" },
  { slug: "novedades", title: "Otras novedades", desc: "Convivencia, acuerdos e incumplimientos (bitácora del arriendo).", icon: "🗒️", phase: "Durante el arriendo" },
  { slug: "soportes-codeudor", title: "Soportes de ingresos", desc: "Carta laboral, colillas y extractos del codeudor e inquilino.", icon: "💼", phase: "Durante el arriendo" },
  { slug: "aliados", title: "Aliados y servicios", desc: "Seguro, cobranza, estudio de crédito, jurídica… tú eliges.", icon: "🤝", phase: "Durante el arriendo", optional: true },
  { slug: "renovar", title: "Renovar contrato", desc: "Otrosí de prórroga y reajuste (IPC) con el mismo inquilino.", icon: "🔄", phase: "Cierre" },
  { slug: "reputacion", title: "Calificar la experiencia", desc: "Califica al inquilino al final del arriendo.", icon: "⭐", phase: "Cierre" },
  { slug: "evidencia", title: "Paquete de evidencia (ZIP)", desc: "Descarga unificada del expediente cuando esté disponible.", icon: "🗂️", phase: "Cierre" },
];

const PHASES: Action["phase"][] = ["Entrega", "Durante el arriendo", "Cierre"];

export default function GestionarPosventaPage() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  const { user } = useAuth();
  const sc = useSavedContract(id);
  const saved = sc.status === "saved";
  const unlocked = saved || sc.status === "error";
  const versionId = sc.currentVersionId ?? "";

  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const [status, setStatus] = useState<Record<StatusKey, ItemStatus>>({
    documentos: "loading", pago: "loading", calendario: "loading", entrega: "loading", notaria: "loading",
  });

  useEffect(() => {
    setDraft(getDraft(id));
  }, [id]);

  useEffect(() => {
    if (!saved || !versionId) return;
    let cancelled = false;
    const vq = `contractId=${encodeURIComponent(id)}&contractVersionId=${encodeURIComponent(versionId)}`;
    const done = (k: StatusKey, ok: boolean) => !cancelled && setStatus((s) => ({ ...s, [k]: ok ? "done" : "pending" }));

    void (async () => {
      const authH = user ? await buildAuthHeaders(user) : {};
      fetch(`/api/contracts/property-documents/list?${vq}`, { headers: { ...authH } })
        .then((r) => r.json()).then((j) => done("documentos", Array.isArray(j?.documents) && j.documents.length > 0)).catch(() => done("documentos", false));
      fetch(`/api/contracts/payment-settings?contractId=${encodeURIComponent(id)}`, { headers: { ...authH } })
        .then((r) => r.json()).then((j) => done("pago", Boolean(j?.settings && j.settings.method && j.settings.method !== "none"))).catch(() => done("pago", false));
      fetch(`/api/payments/schedule/list?${vq}`, { headers: { ...authH } })
        .then((r) => r.json()).then((j) => done("calendario", Array.isArray(j?.scheduledPayments) && j.scheduledPayments.length > 0)).catch(() => done("calendario", false));
      fetch(`/api/contracts/annexes/list?${vq}`, { headers: { ...authH } })
        .then((r) => r.json()).then((j) => {
          const annexes: Array<{ annexType?: string; status?: string; pdfUrl?: string | null }> = Array.isArray(j?.annexes) ? j.annexes : [];
          done("entrega", annexes.some((a) => a.annexType === "initial_delivery_act" && a.status === "generated"));
          done("notaria", annexes.some((a) => a.annexType === "notarial_authentication" && Boolean(a.pdfUrl)));
        }).catch(() => { done("entrega", false); done("notaria", false); });
    })();
    return () => { cancelled = true; };
  }, [saved, versionId, id, user]);

  const title = (draft?.property?.address || "").trim() || "Tu contrato";
  const tenant = (draft?.tenant?.fullName || "").trim();

  function badge(a: Action) {
    if (!a.statusKey) return null;
    const st = status[a.statusKey];
    if (st === "loading") return <span className="text-[11px] text-slate-400">…</span>;
    if (st === "done") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ Hecho</span>;
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pendiente</span>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#37D0E8,#3A7BFF)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#3FD98A,#12B886)" }} />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/nuevo/contratos" className="flex items-center gap-2 text-sm font-semibold text-[#5646E5] hover:underline">← Mis contratos</Link>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Administra tu arriendo</span>
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-none tracking-tight">Administra tu arriendo</h1>
        <p className="mt-3 text-lg text-slate-500">
          {title}{tenant ? ` · Inquilino: ${tenant}` : ""}. Elige <b>una cosa a la vez</b>.
        </p>

        {/* Entrada al flujo "Termina tu contrato" (documentos, pagos y alertas). */}
        {unlocked && (
          <button
            onClick={() => router.push(`/nuevo/gestionar/${id}/terminar`)}
            className={`mt-6 flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.99] ${status.documentos === "pending" || status.pago === "pending" ? "border-amber-300 bg-amber-50/70 hover:border-amber-400" : "border-slate-200 bg-white/90 hover:border-[#5646E5]"}`}
          >
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#ECE9FB] text-xl">🧩</span>
            <span className="min-w-0 flex-1">
              <b className="text-[15px]">Termina tu contrato</b>
              <span className="mt-0.5 block text-[13px] text-slate-500">
                {status.documentos === "pending" || status.pago === "pending"
                  ? "Te falta cargar documentos y/o configurar los pagos. Complétalo paso a paso."
                  : "Documentos, condiciones de pago y alertas — paso a paso."}
              </span>
            </span>
            <span className="self-center text-sm font-bold text-[#5646E5]">→</span>
          </button>
        )}

        {!unlocked && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-2xl">🔒</div>
            <p className="text-lg font-bold text-slate-900">La posventa se habilita al guardar el contrato</p>
            <p className="mt-1 text-slate-600">Termina y guarda tu contrato en la vista previa y vuelve aquí.</p>
            <button onClick={() => router.push(`/dashboard/contracts/${id}/preview`)}
              className="mt-4 rounded-2xl bg-[#FF6B4A] px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95">
              Ir a terminar y guardar →
            </button>
          </motion.div>
        )}

        {unlocked && PHASES.map((phase) => (
          <section key={phase} className="mt-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{phase}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACTIONS.filter((a) => a.phase === phase).map((a, idx) => (
                <motion.button
                  key={a.slug}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                  onClick={() => router.push(a.slug === "inventory" ? `/nuevo/gestionar/${id}/inventario` : a.slug === "aliados" ? `/nuevo/gestionar/${id}/aliados` : `/dashboard/contracts/${id}/${a.slug}`)}
                  className="flex items-start gap-3.5 rounded-2xl border-2 border-slate-200 bg-white/90 p-4 text-left shadow-sm transition hover:border-[#5646E5] active:scale-[0.99]"
                >
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#ECE9FB] text-xl">{a.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-[15px] leading-tight">{a.title}</b>
                      {a.optional && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Opcional</span>}
                      {badge(a)}
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-slate-500">{a.desc}</span>
                  </span>
                  <span className="self-center text-sm font-bold text-[#5646E5]">→</span>
                </motion.button>
              ))}
            </div>
          </section>
        ))}

        {unlocked && (
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => router.push(`/dashboard/contracts/${id}/preview`)} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#5646E5]">Ver contrato</button>
            <button onClick={() => router.push("/nuevo/contratos")} className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#5646E5]">Otros contratos</button>
          </div>
        )}
      </div>
    </div>
  );
}
