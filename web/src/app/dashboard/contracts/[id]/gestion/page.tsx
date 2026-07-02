"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { WizardSteps5 } from "@/components/contracts/wizard-steps5";
import { RequiresSavedContract } from "@/components/contracts/requires-saved-contract";

/**
 * "Gestiona tu arriendo" — posventa en 2 pasos:
 *   1. Lleva el control  (novedades/solicitudes/mantenimientos + pagos + alertas)
 *   2. Califica la experiencia  (calificación bidireccional por estrellas)
 */
export default function GestionArriendoPage() {
  const id = String(useParams<{ id: string }>().id);
  const base = `/dashboard/contracts/${id}`;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Gestiona tu arriendo</p>
        <h1 className="text-2xl font-bold tracking-tight">Durante y al cierre del arriendo</h1>
        <p className="text-sm text-slate-600">
          Dos pasos para acompañar todo el arriendo: lleva el control del día a día y, al cerrar, califica la
          experiencia.
        </p>
        <div className="pt-1">
          <WizardSteps5 id={id} active="posventa" />
        </div>
      </header>

      <RequiresSavedContract id={id}>
        <div className="grid gap-4">
          {/* Paso 1 — Lleva el control */}
          <section className="rounded-2xl border border-violet-300 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                1
              </span>
              <h2 className="text-base font-bold text-slate-900">Lleva el control</h2>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Registra y notifica lo que pasa durante el arriendo. Las <strong>novedades</strong> (solicitudes,
              mantenimientos, daños, avisos) quedan documentadas y se avisan a <strong>ambas partes</strong>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`${base}/novedades`} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                Novedades y solicitudes
              </Link>
              <Link href={`${base}/pagos-recordatorios`} className="rounded-lg border border-violet-400 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50">
                Pagos y recordatorios
              </Link>
              <Link href={`${base}/alertas`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:border-violet-500">
                Alertas del contrato
              </Link>
            </div>
          </section>

          {/* Paso 2 — Califica la experiencia */}
          <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                2
              </span>
              <h2 className="text-base font-bold text-slate-900">Califica la experiencia</h2>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Al cerrar el arriendo, califica a la otra parte <strong>solo con estrellas</strong> (variables
              predefinidas, sin comentarios de texto). Es <strong>bidireccional</strong>, le llega un aviso al calificado
              y tiene <strong>derecho de réplica</strong>. Privada: sin listas negras ni búsqueda por cédula.
            </p>
            <div className="mt-3">
              <Link href={`${base}/reputacion`} className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
                Calificar la experiencia
              </Link>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Disponible cuando el contrato está firmado o cerrado. Conforme a la{" "}
              <Link href="/legal/evaluacion" className="text-violet-700 underline">política de evaluación</Link>.
            </p>
          </section>

          <p className="text-sm text-slate-600">
            <Link href={`${base}/adicionales`} className="text-violet-700 underline">← Volver a la posventa</Link>
          </p>
        </div>
      </RequiresSavedContract>
    </main>
  );
}
