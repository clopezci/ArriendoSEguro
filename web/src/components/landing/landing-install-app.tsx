"use client";

import { PwaInstallHelpDialog } from "@/components/pwa/pwa-install-help-dialog";
import { usePwaInstall } from "@/hooks/use-pwa-install";

type LandingInstallAppProps = {
  className?: string;
  /** Etiqueta del botón principal. */
  label?: string;
};

export function LandingInstallApp({ className = "", label = "Instalar aplicación" }: LandingInstallAppProps) {
  const { busy, helpOpen, helpMode, visible, closeHelp, onInstallClick } = usePwaInstall();

  if (!visible) return null;

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

      {helpOpen && <PwaInstallHelpDialog mode={helpMode} onClose={closeHelp} />}
    </>
  );
}
