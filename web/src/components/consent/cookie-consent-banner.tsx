"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OPEN_PREFERENCES_EVENT, readConsent, saveConsent } from "@/lib/consent/cookie-consent";

type View = "hidden" | "banner" | "preferences";

export function CookieConsentBanner() {
  const [view, setView] = useState<View>("hidden");
  const [analytics, setAnalytics] = useState(false);
  const [ads, setAds] = useState(false);

  // Al montar: si no hay decisión previa, mostramos el banner.
  useEffect(() => {
    const existing = readConsent();
    if (!existing) {
      setView("banner");
    } else {
      setAnalytics(existing.analytics);
      setAds(existing.ads);
    }
  }, []);

  // Permite reabrir el panel desde el footer ("Preferencias de cookies").
  useEffect(() => {
    function openPrefs() {
      const existing = readConsent();
      setAnalytics(existing?.analytics ?? false);
      setAds(existing?.ads ?? false);
      setView("preferences");
    }
    window.addEventListener(OPEN_PREFERENCES_EVENT, openPrefs);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, openPrefs);
  }, []);

  if (view === "hidden") return null;

  function acceptAll() {
    saveConsent({ analytics: true, ads: true });
    setView("hidden");
  }

  function rejectAll() {
    saveConsent({ analytics: false, ads: false });
    setView("hidden");
  }

  function savePreferences() {
    saveConsent({ analytics, ads });
    setView("hidden");
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Consentimiento de cookies"
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-300 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.28)] sm:p-5">
        {view === "banner" ? (
          <>
            <h2 className="text-base font-semibold text-slate-900">Usamos cookies</h2>
            <p className="mt-2 text-sm text-slate-700">
              Usamos cookies necesarias para que el sitio funcione y, si lo autorizas, cookies de
              analítica para entender el uso y (en el futuro) de publicidad. Puedes aceptar,
              rechazar o configurar tus preferencias. Más detalle en nuestra{" "}
              <Link href="/legal/cookies" className="text-violet-700 underline">
                política de cookies
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={acceptAll}
                className="min-h-11 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
              >
                Aceptar todas
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Rechazar no esenciales
              </button>
              <button
                type="button"
                onClick={() => setView("preferences")}
                className="min-h-11 rounded-lg border border-violet-400 bg-white px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50"
              >
                Configurar
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-slate-900">Preferencias de cookies</h2>
            <p className="mt-2 text-sm text-slate-700">
              Elige qué categorías permites. Las cookies necesarias no se pueden desactivar.
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-900">Necesarias</span>
                  <span className="text-xs font-medium text-slate-500">Siempre activas</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Sesión, seguridad y control anti-bot. Imprescindibles para usar el sitio.
                </p>
              </div>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <span>
                  <span className="text-sm font-medium text-slate-900">Analítica</span>
                  <span className="mt-1 block text-xs text-slate-600">
                    Google Analytics 4: nos ayuda a entender el uso de forma agregada.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-violet-600"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <span>
                  <span className="text-sm font-medium text-slate-900">Publicidad</span>
                  <span className="mt-1 block text-xs text-slate-600">
                    Cookies de anuncios (Google AdSense) para mostrar publicidad. Hoy pueden no
                    estar activas aún; tu preferencia se respetará cuando lo estén.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-violet-600"
                  checked={ads}
                  onChange={(e) => setAds(e.target.checked)}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={savePreferences}
                className="min-h-11 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
              >
                Guardar preferencias
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="min-h-11 rounded-lg border border-violet-400 bg-white px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50"
              >
                Aceptar todas
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Rechazar no esenciales
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
