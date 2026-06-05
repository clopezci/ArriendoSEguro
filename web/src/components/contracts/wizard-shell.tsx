"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

/**
 * Pasos del **Bloque 1** (asistente mínimo para generar el contrato). Lo
 * opcional (cláusulas, garantía, codeudores adicionales, método de pago) y la
 * posventa (evidencias, pagos, inventario, novedades) viven fuera del progreso
 * lineal y usan `variant="extra"`.
 */
export const WIZARD_STEPS = [
  "Tipo de contrato",
  "Arrendador (dueño)",
  "Arrendatario (inquilino)",
  "Codeudor",
  "Inmueble a arrendar",
  "Términos",
  "Servicios",
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
}: {
  title: string;
  currentStep: number;
  contractId: string;
  children: ReactNode;
  /** "wizard" muestra el progreso del Bloque 1; "extra" es adicionales/posventa. */
  variant?: "wizard" | "extra";
}) {
  const clamped = Math.min(Math.max(currentStep, 1), steps.length);
  const progress = useMemo(() => Math.round((clamped / steps.length) * 100), [clamped]);

  if (variant === "extra") {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
            <Link
              href={`/dashboard/contracts/${contractId}/adicionales`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-violet-500 hover:text-violet-700"
            >
              Centro de adicionales
            </Link>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Configuración adicional y posventa del expediente (no forma parte del asistente principal).
          </p>
        </div>
        <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
          <Link
            href={`/dashboard/contracts/${contractId}/review`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:border-violet-500 hover:text-violet-700"
          >
            Ir a resumen
          </Link>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-700">
            <span>
              Paso {clamped} de {steps.length}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded bg-slate-200">
            <div
              className="h-2 rounded bg-violet-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-[11px] text-slate-600 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9">
            {steps.map((s, idx) => (
              <span
                key={s}
                className={idx + 1 <= clamped ? "font-medium text-violet-700" : ""}
              >
                {idx + 1}. {s}
              </span>
            ))}
          </div>
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

