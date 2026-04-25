"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

const steps = [
  "Acceso",
  "Arrendador",
  "Arrendatario",
  "Codeudor",
  "Inmueble",
  "Términos",
  "Servicios",
  "Resumen",
  "Vista previa",
] as const;

export function WizardShell({
  title,
  currentStep,
  contractId,
  children,
}: {
  title: string;
  currentStep: number;
  contractId: string;
  children: ReactNode;
}) {
  const progress = useMemo(() => Math.round((currentStep / steps.length) * 100), [currentStep]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.2)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-100 sm:text-2xl">{title}</h1>
          <Link
            href={`/dashboard/contracts/${contractId}/review`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-violet-400 hover:text-violet-300"
          >
            Ir a resumen
          </Link>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
            <span>
              Paso {currentStep} de {steps.length}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded bg-slate-800">
            <div
              className="h-2 rounded bg-violet-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-[11px] text-slate-400 sm:grid-cols-9">
            {steps.map((s, idx) => (
              <span
                key={s}
                className={idx + 1 <= currentStep ? "font-medium text-violet-300" : ""}
              >
                {idx + 1}. {s}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
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
    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-500/50 bg-amber-900/20 p-6 text-center shadow-[0_10px_24px_rgba(245,158,11,0.2)]">
      <h2 className="text-xl font-semibold text-amber-200">Acceso bloqueado</h2>
      <p className="mt-2 text-amber-100/90">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard/billing"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.35)]"
        >
          Activar Plan Plus
        </Link>
        <Link
          href="/dashboard/contracts/access-blocked"
          className="rounded-lg border border-violet-400 px-4 py-2 text-sm font-medium text-violet-200"
        >
          Probar demo
        </Link>
      </div>
    </div>
  );
}

