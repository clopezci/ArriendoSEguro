"use client";

import { stepGuide, POSTSALE_GUIDE } from "@/features/contracts/step-guide";
import { MACRO_STEPS, macroForWizardIndex } from "@/features/contracts/steps5";

/**
 * Banner de guía simple «dónde estás / qué sigue». El número grande cuenta sobre
 * los 5 macro-pasos (no sobre los sub-pasos), para no confundir; debajo va el
 * detalle del sub-bloque actual. Se monta dentro del WizardShell.
 */
export function StepGuide({ currentStep, variant }: { currentStep: number; variant: "wizard" | "extra" }) {
  if (variant === "extra") {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-sm text-slate-700">
        <span className="font-semibold text-violet-800">{POSTSALE_GUIDE.group}</span> — {POSTSALE_GUIDE.hint}
      </div>
    );
  }

  const g = stepGuide(currentStep);
  if (!g) return null;
  const macro = MACRO_STEPS.find((m) => m.key === macroForWizardIndex(currentStep));
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-sm leading-relaxed text-slate-700">
      <span className="font-semibold text-violet-800">
        Paso {macro?.number ?? 1} de 5 · {macro?.label ?? g.group}
      </span>
      <span className="mt-0.5 block text-slate-600">
        {g.title} — {g.hint}
      </span>
      <span className="mt-0.5 block text-slate-500">➜ Sigue: {g.next}</span>
    </div>
  );
}
