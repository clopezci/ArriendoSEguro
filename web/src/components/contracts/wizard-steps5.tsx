"use client";

import Link from "next/link";
import {
  MACRO_STEPS,
  POSTVENTA_STEP,
  deriveMacroStates,
  type MacroStepKey,
} from "@/features/contracts/steps5";
import { useSavedContract } from "./requires-saved-contract";

/**
 * Franja interactiva de los 5 pasos (rediseño 2026-07). Cada paso lleva a su
 * punto de entrada si no está bloqueado; el paso actual se resalta. La posventa
 * se muestra aparte, sin número.
 */
export function WizardSteps5({
  id,
  active,
}: {
  id: string;
  /** Macro-paso actual, o "posventa". */
  active: MacroStepKey | "posventa";
}) {
  const sc = useSavedContract(id);
  const states = deriveMacroStates(
    sc.status === "loading"
      ? null
      : { currentVersionId: sc.currentVersionId, contractStatus: sc.contractStatus },
  );

  return (
    <ol className="flex flex-wrap items-stretch gap-1.5" aria-label="Progreso del contrato">
      {MACRO_STEPS.map((step) => {
        const isActive = active === step.key;
        const state = states[step.key];
        const done = state === "done" && !isActive;
        const locked = state === "locked" && !isActive;

        const cls = isActive
          ? "border-violet-500 bg-violet-100 text-violet-900 font-semibold shadow-sm"
          : done
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : locked
              ? "border-slate-200 bg-slate-50 text-slate-400"
              : "border-slate-300 bg-white text-slate-700";

        const inner = (
          <>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                isActive
                  ? "bg-violet-600 text-white"
                  : done
                    ? "bg-emerald-500 text-white"
                    : locked
                      ? "bg-slate-200 text-slate-500"
                      : "bg-slate-200 text-slate-700"
              }`}
              aria-hidden="true"
            >
              {done ? "✓" : locked ? "🔒" : step.number}
            </span>
            <span className="leading-tight">{step.label}</span>
          </>
        );

        const boxCls = `flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[12px] ${cls}`;

        return (
          <li key={step.key} aria-current={isActive ? "step" : undefined}>
            {locked ? (
              <span title={`${step.hint} (disponible cuando guardes el contrato)`} className={`${boxCls} cursor-not-allowed`}>
                {inner}
              </span>
            ) : (
              <Link href={step.entry(id)} title={step.hint} className={`${boxCls} transition hover:brightness-95`}>
                {inner}
              </Link>
            )}
          </li>
        );
      })}

      {/* Posventa: aparte, sin número */}
      <li aria-current={active === "posventa" ? "step" : undefined}>
        {states.posventa === "locked" && active !== "posventa" ? (
          <span
            title={`${POSTVENTA_STEP.hint} (disponible cuando guardes el contrato)`}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-400"
          >
            <span aria-hidden="true">🔒</span>
            {POSTVENTA_STEP.label}
          </span>
        ) : (
          <Link
            href={POSTVENTA_STEP.entry(id)}
            title={POSTVENTA_STEP.hint}
            className={`flex items-center gap-1.5 rounded-xl border border-dashed px-2.5 py-1.5 text-[12px] transition hover:brightness-95 ${
              active === "posventa"
                ? "border-violet-500 bg-violet-100 font-semibold text-violet-900"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            <span aria-hidden="true">★</span>
            {POSTVENTA_STEP.label}
          </Link>
        )}
      </li>
    </ol>
  );
}
