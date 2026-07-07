"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { getAllDrafts, type ContractDraft } from "@/features/contracts/wizard-state";
import { isExpedienteCompleto } from "@/lib/dashboard/expediente-ui";

/**
 * F4 del rediseño "Un paso a la vez": pantalla "Gestionar mis contratos" en el
 * estilo nuevo, alimentada por los MISMOS borradores del asistente actual
 * (getAllDrafts). Cada tarjeta continúa o abre la vista previa del expediente.
 */
export default function GestionarContratosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [drafts, setDrafts] = useState<ContractDraft[] | null>(null);

  useEffect(() => {
    // localStorage: solo en cliente.
    const all = getAllDrafts()
      .filter((d) => !user || d.userId === user.uid)
      .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
    setDrafts(all);
  }, [user]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#37D0E8,#3A7BFF)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/nuevo" className="flex items-center gap-2 text-sm font-semibold text-[#5646E5] hover:underline">← Inicio</Link>
          <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Vista nueva (beta)</span>
        </div>

        <h1 className="text-balance text-4xl font-extrabold leading-none tracking-tight">Mis contratos</h1>
        <p className="mt-3 text-lg text-slate-500">Continúa donde quedaste, revisa o firma.</p>

        {drafts === null ? (
          <p className="mt-10 text-slate-400">Cargando…</p>
        ) : drafts.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10 rounded-3xl border border-slate-200 bg-white/70 p-10 text-center backdrop-blur">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#ECE9FB] text-3xl">🏡</div>
            <p className="text-lg font-semibold">Aún no tienes contratos</p>
            <p className="mt-1 text-slate-500">Crea el primero en unos minutos, una pregunta a la vez.</p>
            <button onClick={() => router.push("/nuevo")} className="mt-5 rounded-2xl bg-[#FF6B4A] px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-105 active:scale-95">
              Crear mi primer contrato →
            </button>
          </motion.div>
        ) : (
          <div className="mt-8 grid gap-4">
            {drafts.map((d, idx) => {
              const complete = isExpedienteCompleto(d);
              const title = (d.property?.address || "").trim() || "Contrato en preparación";
              const owner = (d.landlord?.fullName || "").trim();
              const tenant = (d.tenant?.fullName || "").trim();
              const updated = new Date(d.lastUpdatedAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
              return (
                <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                  className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold tracking-tight">{title}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-500">
                        {owner ? `Dueño: ${owner}` : "Sin dueño aún"}{tenant ? ` · Inquilino: ${tenant}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">Actualizado {updated}</p>
                    </div>
                    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {complete ? "Listo para generar" : "En progreso"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button onClick={() => router.push(`/dashboard/contracts/${d.id}/contract-type`)} className="rounded-xl bg-[#5646E5] px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-105 active:scale-95">Continuar</button>
                    <button onClick={() => router.push(`/dashboard/contracts/${d.id}/preview`)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#5646E5]">Vista previa</button>
                  </div>
                </motion.div>
              );
            })}
            <button onClick={() => router.push("/nuevo")} className="mt-2 rounded-2xl border-2 border-dashed border-slate-300 py-4 text-base font-semibold text-slate-500 transition hover:border-[#5646E5] hover:text-[#5646E5]">
              + Crear otro contrato
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
