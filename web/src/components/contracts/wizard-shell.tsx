"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { WizardSteps5 } from "./wizard-steps5";
import { SaveFlash } from "./save-flash";
import { StepGuide } from "./step-guide";
import type { ContractPhase } from "@/features/contracts/journey";
import { macroForWizardIndex, type MacroStepKey } from "@/features/contracts/steps5";

/**
 * Pasos del **Bloque 1** (asistente mínimo para generar el contrato). Lo
 * opcional (cláusulas, garantía, codeudores adicionales, método de pago) y la
 * posventa (evidencias, pagos, inventario, novedades) viven fuera del progreso
 * lineal y usan `variant="extra"`.
 */
export const WIZARD_STEPS = [
  "Tipo de contrato",
  "Arrendador (dueño)",
  "Inmueble a arrendar",
  "Arrendatario (inquilino)",
  "Codeudor",
  "Términos",
  "Servicios",
  "Cláusulas especiales",
  "Resumen",
  "Vista previa",
] as const;

const steps = WIZARD_STEPS;

export function WizardShell({
  title,
  currentStep,
  contractId,
  children,
  variant = "wizard",
  phase,
  macroStep,
}: {
  title: string;
  currentStep: number;
  contractId: string;
  children: ReactNode;
  /** "wizard" muestra el progreso del Bloque 1; "extra" es adicionales/posventa. */
  variant?: "wizard" | "extra";
  /** (Compat) fase global; ya no se usa para pintar, se mantiene por firma. */
  phase?: ContractPhase;
  /** Macro-paso a resaltar. Si no se pasa, se infiere del `currentStep`/variant. */
  macroStep?: MacroStepKey | "posventa";
}) {
  const clamped = Math.min(Math.max(currentStep, 1), steps.length);
  const active: MacroStepKey | "posventa" =
    macroStep ?? (variant === "extra" ? "posventa" : macroForWizardIndex(clamped));

  if (variant === "extra") {
    return (
      <div className="space-y-5">
        <SaveFlash />
        <div className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
            <Link
              href={`/dashboard/contracts/${contractId}/adicionales`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-violet-500 hover:text-violet-700"
            >
              ← Volver a la posventa
            </Link>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Configuración adicional y posventa del expediente (no forma parte del asistente principal).
          </p>
          <div className="mt-3">
            <WizardSteps5 id={contractId} active={active} />
          </div>
          <div className="mt-2">
            <StepGuide currentStep={clamped} variant="extra" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SaveFlash />
      <div className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        <div className="mt-3">
          <WizardSteps5 id={contractId} active={active} />
        </div>
        <div className="mt-3">
          <StepGuide currentStep={clamped} variant="wizard" />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
        {children}
      </div>
    </div>
  );
}

export function AccessBlocked({
  reason,
}: {
  reason: "pending_payment" | "expired";
}) {
  const message =
    reason === "pending_payment"
      ? "Tu acceso aún no está habilitado. Para crear un contrato, activa tu plan o solicita un demo."
      : "Tu acceso de demo expiró. Activa tu plan para continuar.";

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center shadow-[0_10px_24px_rgba(245,158,11,0.2)]">
      <h2 className="text-xl font-semibold text-amber-800">Acceso bloqueado</h2>
      <p className="mt-2 text-amber-800">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard/plans"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.35)]"
        >
          Activar Plan Plus
        </Link>
        <Link
          href="/demo"
          className="rounded-lg border border-violet-500 px-4 py-2 text-sm font-medium text-violet-700"
        >
          Probar demo
        </Link>
      </div>
    </div>
  );
}

