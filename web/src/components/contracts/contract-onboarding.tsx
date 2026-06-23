"use client";

import { useCallback, useEffect, useState } from "react";
import { getAllDrafts, logGlobalAudit } from "@/features/contracts/wizard-state";

const WELCOME_KEY = "as_welcome_dismissed_v1";
const TOUR_KEY = "as_tour_done_v1";

const TOUR_STEPS: { title: string; body: string }[] = [
  {
    title: "1. Tus datos y el inmueble",
    body: "Tus datos como dueño (puedes guardarlos y reutilizarlos), los del inquilino y codeudor (los llenas tú o les envías un enlace), y el inmueble. La validación crediticia del inquilino es opcional.",
  },
  {
    title: "2. Condiciones del contrato",
    body: "Términos (canon, fechas, día de pago), servicios y garantía del Art. 15, y cláusulas especiales. Todo en una sola línea.",
  },
  {
    title: "3. Revisa, guarda y firma",
    body: "Revisa el resumen, en la Vista previa pulsa «Guardar mi contrato», descarga el PDF y, con Plan Plus, fírmalo con respaldo legal (OTP + evidencia, Ley 527).",
  },
  {
    title: "4. Pagos (casi automático)",
    body: "El calendario de pagos se arma solo con las fechas del contrato. Tú solo eliges tu método de pago (cuenta/QR) y con cuántos días de anticipación avisar al inquilino.",
  },
  {
    title: "5. Alertas, documentos e inventario",
    body: "Activa alertas de terminación/renovación, sube tus documentos (cada uno con su botón «Adjuntar») y haz el inventario con fotos (ahora o el día de la entrega).",
  },
];

/**
 * Onboarding del flujo REAL de creación de contratos: una tarjeta de bienvenida
 * (solo en el primer contrato) que explica las fases y un tour guiado de 5 pasos
 * reabrible. Persistencia en `localStorage` (leída en efecto para evitar
 * hydration mismatch). Telemetría con `logGlobalAudit`.
 */
export function ContractOnboarding() {
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const dismissed = window.localStorage.getItem(WELCOME_KEY) === "1";
      const firstContract = getAllDrafts().length <= 1;
      if (!dismissed && firstContract) {
        setWelcomeOpen(true);
        logGlobalAudit("onboarding_welcome_shown");
      }
    } catch {
      /* sin localStorage: no mostramos nada */
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    setWelcomeOpen(false);
    try {
      window.localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      /* noop */
    }
    logGlobalAudit("onboarding_welcome_dismissed");
  }, []);

  const openTour = useCallback(() => {
    setStep(0);
    setTourOpen(true);
    logGlobalAudit("onboarding_tour_opened");
  }, []);

  const closeTour = useCallback((completed: boolean) => {
    setTourOpen(false);
    try {
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* noop */
    }
    if (completed) logGlobalAudit("onboarding_tour_completed");
  }, []);

  if (!mounted) return null;

  return (
    <>
      {welcomeOpen ? (
        <section
          role="note"
          className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-[0_10px_28px_rgba(139,92,246,0.16)]"
        >
          <h2 className="text-base font-bold text-slate-900">Te guiamos en 2 fases</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            <strong>1) Crea tu contrato gratis</strong> con los datos mínimos. <strong>2) Robustécelo</strong> (codeudores,
            garantía, cláusulas), <strong>fírmalo</strong> con respaldo legal y <strong>descárgalo en PDF</strong>. Después
            tienes la posventa (pagos, recordatorios y novedades).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openTour}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
            >
              Ver cómo funciona
            </button>
            <button
              type="button"
              onClick={dismissWelcome}
              className="rounded-lg border border-violet-400 px-4 py-2 text-sm font-medium text-violet-700"
            >
              Entendido, empezar
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={openTour}
          className="text-xs font-medium text-violet-700 underline hover:text-violet-900"
        >
          ¿Cómo funciona? Ver guía rápida
        </button>
      )}

      {tourOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cómo funciona ArriendoSeguro"
        >
          <div className="w-full max-w-md rounded-2xl border border-violet-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.35)]">
            <ol className="flex flex-wrap items-center gap-1.5" aria-hidden="true">
              {TOUR_STEPS.map((_, i) => (
                <li
                  key={i}
                  className={`h-1.5 w-6 rounded-full ${i <= step ? "bg-violet-500" : "bg-slate-200"}`}
                />
              ))}
            </ol>
            <h3 className="mt-3 text-base font-bold text-slate-900">{TOUR_STEPS[step]?.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{TOUR_STEPS[step]?.body}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => closeTour(false)}
                className="text-xs text-slate-500 underline hover:text-slate-700"
              >
                Cerrar
              </button>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                  >
                    Anterior
                  </button>
                )}
                {step < TOUR_STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.min(TOUR_STEPS.length - 1, s + 1))}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Siguiente
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => closeTour(true)}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Empezar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
