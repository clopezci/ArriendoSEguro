"use client";

import { CONTRACT_PHASES, deriveJourneyState, type ContractPhase } from "@/features/contracts/journey";
import { useSavedContract } from "./requires-saved-contract";

/**
 * Franja de progreso de las 5 fases del contrato (Datos → Robustecer → Firmar →
 * PDF → Posventa), coherente en todas las páginas. Consulta `latest-version`
 * (vía `useSavedContract`) para saber qué fases están hechas/disponibles, y
 * resalta la fase actual de la página (`activePhase`).
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
        return (
          <li
            key={p.key}
            title={p.hint}
            aria-current={isCurrent ? "step" : undefined}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${cls}`}
          >
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
          </li>
        );
      })}
    </ol>
  );
}
