"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PwaInstallHelpDialog } from "@/components/pwa/pwa-install-help-dialog";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const DISMISS_KEY = "as-pwa-install-banner-dismissed";

/** Rutas donde no mostramos el banner (la landing ya tiene sección dedicada). */
function shouldHideBanner(pathname: string): boolean {
  return pathname === "/";
}

/**
 * Barra compacta fija para instalar la PWA en cualquier página.
 * Se oculta en `/` (sección de instalación en la landing) y si el usuario eligió «Ahora no».
 */
export function PwaInstallSiteBanner() {
  const pathname = usePathname() ?? "";
  const { busy, helpOpen, helpMode, visible, closeHelp, onInstallClick } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignorar */
    }
    setDismissed(true);
  }, []);

  if (shouldHideBanner(pathname) || dismissed || !visible) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Instalar aplicación"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-200 bg-gradient-to-r from-violet-50 to-white px-4 py-3 shadow-[0_-4px_24px_rgba(124,58,237,0.12)] sm:px-6"
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 sm:justify-between">
          <p className="text-center text-sm text-slate-700 sm:text-left">
            <span className="font-semibold text-violet-800">Instala ArriendoSeguro</span>
            <span className="hidden sm:inline"> — </span>
            <span className="block sm:inline">acceso rápido a contratos y expedientes.</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void onInstallClick()}
              disabled={busy}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {busy ? "Preparando…" : "Instalar"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
      {helpOpen && <PwaInstallHelpDialog mode={helpMode} onClose={closeHelp} />}
    </>
  );
}
