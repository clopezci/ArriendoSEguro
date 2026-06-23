"use client";

import { stepGuide, POSTSALE_GUIDE } from "@/features/contracts/step-guide";

/**
 * Banner de guía simple «dónde estás / qué sigue» para el onboarding de una sola
 * línea. Se monta dentro del WizardShell, así aparece en todas las páginas sin
 * tocarlas una por una.
 */
export function StepGuide({ currentStep, variant }: { currentStep: number; variant: "wizard" | "extra" }) {
  if (variant === "extra") {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs text-slate-700">
        <span className="font-semibold text-violet-800">{POSTSALE_GUIDE.group}</span> — {POSTSALE_GUIDE.hint}
      </div>
    );
  }

  const g = stepGuide(currentStep);
  if (!g) return null;
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs leading-relaxed text-slate-700">
      <span className="font-semibold text-violet-800">
        Paso {g.index} de {g.total} · {g.title}
      </span>{" "}
      — {g.hint}
      <span className="mt-0.5 block text-slate-500">➜ Sigue: {g.next}</span>
    </div>
  );
}
