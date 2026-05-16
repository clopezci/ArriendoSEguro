"use client";

import { useCallback, useEffect, useState } from "react";

/** Evento `beforeinstallprompt` (Chromium / Edge / Android). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallUiState = "loading" | "hidden" | "native" | "ios" | "manual";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

type LandingInstallAppProps = {
  className?: string;
  /** Etiqueta del botón principal. */
  label?: string;
};

export function LandingInstallApp({ className = "", label = "Instalar aplicación" }: LandingInstallAppProps) {
  const [uiState, setUiState] = useState<InstallUiState>("loading");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setUiState("hidden");
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setUiState("native");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const timer = window.setTimeout(() => {
      setUiState((prev) => {
        if (prev === "native") return prev;
        if (isIosDevice()) return "ios";
        return "manual";
      });
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearTimeout(timer);
    };
  }, []);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  const onInstallClick = useCallback(async () => {
    if (uiState === "ios" || uiState === "manual") {
      openHelp();
      return;
    }
    if (!deferredPrompt) {
      openHelp();
      return;
    }
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setUiState("hidden");
    } catch {
      openHelp();
    } finally {
      setBusy(false);
      setDeferredPrompt(null);
    }
  }, [uiState, deferredPrompt, openHelp]);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, closeHelp]);

  if (uiState === "hidden" || uiState === "loading") return null;

  const helpMode = uiState === "ios" ? "ios" : isAndroidDevice() ? "android" : "desktop";

  return (
    <>
      <button
        type="button"
        onClick={() => void onInstallClick()}
        disabled={busy}
        className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-violet-500 bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(124,58,237,0.35)] transition hover:bg-violet-700 disabled:opacity-60 ${className}`}
      >
        {busy ? "Preparando…" : label}
      </button>

      {helpOpen && (
        <InstallHelpDialog mode={helpMode} onClose={closeHelp} />
      )}
    </>
  );
}

function InstallHelpDialog({
  mode,
  onClose,
}: {
  mode: "ios" | "android" | "desktop";
  onClose: () => void;
}) {
  const title =
    mode === "ios"
      ? "Instalar en iPhone o iPad"
      : mode === "android"
        ? "Instalar en Android"
        : "Instalar en tu computador";

  const steps =
    mode === "ios"
      ? [
          "Abre esta página en Safari (no en un navegador dentro de otra app).",
          "Toca el botón Compartir (ícono con flecha hacia arriba).",
          "Elige «Añadir a pantalla de inicio».",
          "Confirma con «Añadir». Verás el acceso directo en tu pantalla de inicio.",
        ]
      : mode === "android"
        ? [
            "Abre esta página en Chrome (recomendado).",
            "Toca el menú ⋮ (tres puntos) arriba a la derecha.",
            "Elige «Instalar aplicación» o «Añadir a pantalla de inicio».",
            "Confirma. El ícono de ArriendoSeguro quedará en tu pantalla de inicio.",
          ]
        : [
            "Usa Chrome o Edge en escritorio.",
            "Busca el ícono de instalación en la barra de direcciones (⊕ o monitor con flecha) o abre el menú ⋮ → «Instalar ArriendoSeguro…».",
            "Confirma la instalación. Podrás abrir la app desde el menú Inicio o la barra de tareas.",
            "Si no ves la opción, agrega esta página a favoritos para acceder rápido.",
          ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-help-title"
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
      />
      <div className="relative z-[101] w-full max-w-md rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.25)]">
        <h2 id="install-help-title" className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Así tendrás acceso rápido a contratos, expedientes y el panel sin buscar la página cada vez.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-800">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
