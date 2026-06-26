"use client";

import Link from "next/link";
import { CONTRACT_PHASES, deriveJourneyState, type ContractPhase } from "@/features/contracts/journey";
import { useSavedContract } from "./requires-saved-contract";

/** Destino de cada fase al hacer clic (si no está bloqueada). */
function phaseHref(id: string, phase: ContractPhase): string {
  switch (phase) {
    case "datos":
      return `/dashboard/contracts/${id}/review`;
    case "firmar":
    case "pdf":
      return `/dashboard/contracts/${id}/preview`;
    case "posventa":
      return `/dashboard/contracts/${id}/adicionales`;
  }
}

/**
 * Franja de progreso de las 4 fases del contrato (Datos → Firmar → PDF →
 * Posventa), coherente en todas las páginas. Consulta `latest-version` (vía
 * `useSavedContract`) para saber qué fases están hechas/disponibles, resalta la
 * fase actual (`activePhase`) y permite **navegar** a cada fase que no esté
 * bloqueada (clic).
 */
export function JourneyProgress({ id, activePhase }: { id: string; activePhase?: ContractPhase }) {
  const sc = useSavedContract(id);
  const states = deriveJourneyState(
    sc.status === "loading"
      ? null
      : { currentVersionId: sc.currentVersionId, contractStatus: sc.contractStatus },
  );

  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Progreso del contrato">
      {CONTRACT_PHASES.map((p) => {
        const isCurrent = activePhase === p.key;
        const state = states[p.key];
        const done = state === "done";
        const locked = state === "locked" && !isCurrent;
        const cls = isCurrent
          ? "border-violet-500 bg-violet-100/70 text-violet-800 font-semibold"
          : done
            ? "border-violet-300 bg-violet-50 text-violet-700"
            : locked
              ? "border-slate-200 bg-slate-50 text-slate-400"
              : "border-slate-300 bg-white text-slate-600";

        const inner = (
          <>
            {done && (
              <span aria-hidden="true" className="text-violet-600">
                ✓
              </span>
            )}
            {locked && (
              <span aria-hidden="true" role="img" aria-label="Bloqueado">
                🔒
              </span>
            )}
            <span>{p.label}</span>
          </>
        );

        const base = `flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${cls}`;

        return (
          <li key={p.key} aria-current={isCurrent ? "step" : undefined}>
            {locked ? (
              <span title={`${p.hint} (disponible cuando avances)`} className={`${base} cursor-not-allowed`}>
                {inner}
              </span>
            ) : (
              <Link href={phaseHref(id, p.key)} title={p.hint} className={`${base} transition hover:brightness-95`}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
