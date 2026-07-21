"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DeleteContractModal } from "@/components/nuevo/delete-contract-modal";
import { AccountMenu } from "@/components/nuevo/account-menu";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { getAllDrafts, type ContractDraft } from "@/features/contracts/wizard-state";
import { pullServerDraftsIntoLocal, flushAllLocalDraftsToServer } from "@/features/contracts/draft-server-sync";
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
  const [deleting, setDeleting] = useState<ContractDraft | null>(null);

  const load = useCallback(async () => {
    // Reconciliación entre dispositivos: primero EMPUJAMOS los borradores locales
    // que no se hayan sincronizado (p. ej. del celular) y luego TRAEMOS los del
    // servidor. Así ambos equipos convergen al mismo listado (arregla "11 en el
    // celular vs 5 en el PC").
    if (user) {
      try { await flushAllLocalDraftsToServer(user.uid); } catch { /* best-effort */ }
      try { await pullServerDraftsIntoLocal(); } catch { /* seguimos con lo local */ }
    }
    // Solo los contratos de la sesión ACTUAL: si hay usuario, los suyos; si no hay
    // sesión, solo los del borrador "invitado" en curso. NUNCA todos (antes `!user`
    // mostraba los de CUALQUIER cuenta que quedara en este equipo → se veía "la
    // cuenta anterior").
    const all = getAllDrafts()
      .filter((d) => (user ? d.userId === user.uid : d.userId === "invitado"))
      .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
    setDrafts(all);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F5F3EF] text-[#17151F]">
      <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#37D0E8,#3A7BFF)" }} />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: "radial-gradient(circle,#9B6BFF,#5646E5)" }} />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/nuevo" className="flex items-center gap-2 text-sm font-semibold text-[#5646E5] hover:underline">← Inicio</Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs text-slate-500">Vista nueva (beta)</span>
            <AccountMenu />
          </div>
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
          <div className="mt-8 grid grid-cols-1 gap-4">
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
                  {/* En celular: grilla de 2 columnas (cada botón cabe y se ve completo);
                      en escritorio: fila que envuelve. Así "Eliminar" nunca se sale. */}
                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
                    <button onClick={() => router.push(complete ? `/dashboard/contracts/${d.id}/preview` : `/nuevo?id=${d.id}`)} className="col-span-2 rounded-xl bg-[#5646E5] px-5 py-2.5 text-center text-sm font-bold text-white transition hover:brightness-105 active:scale-95 sm:col-span-1">{complete ? "Revisar y finalizar →" : "Continuar donde quedé →"}</button>
                    {complete && (
                      <button onClick={() => router.push(`/nuevo/gestionar/${d.id}`)} className="col-span-2 rounded-xl border border-[#12B886] bg-[#12B886]/10 px-5 py-2.5 text-center text-sm font-bold text-[#0B7A55] transition hover:bg-[#12B886]/20 sm:col-span-1">Gestionar (posventa)</button>
                    )}
                    <button onClick={() => router.push(`/nuevo?id=${d.id}`)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-center text-xs font-medium text-slate-500 transition hover:border-[#5646E5]">Editar datos</button>
                    <button onClick={() => setDeleting(d)} className="rounded-xl border border-rose-200 px-4 py-2.5 text-center text-xs font-semibold text-rose-600 transition hover:border-rose-400 hover:bg-rose-50">🗑️ Eliminar</button>
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

      {deleting && (
        <DeleteContractModal
          contractId={deleting.id}
          ownerName={(deleting.landlord?.fullName || "").trim()}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); void load(); }}
        />
      )}
    </div>
  );
}
