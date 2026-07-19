"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ALLIES_DISMISS_KEY = "promo_allies_dismissed";

/**
 * Publicidad interna (cerrable) de los servicios de aliados. NO vive en el flujo
 * de pago (allí solo debe verse "pagar"); aquí, en el inicio, invita a conocer
 * los servicios de terceros sin presión ni distracción del pago. El usuario la
 * puede cerrar (se recuerda en localStorage).
 */
export function AlliesTeaser() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(ALLIES_DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* localStorage no disponible: la mostramos */
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(ALLIES_DISMISS_KEY, "1");
    } catch {
      /* sin persistencia: al menos se oculta esta sesión */
    }
  }

  if (dismissed) return null;

  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar esta sugerencia"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        ✕
      </button>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servicios de aliados</p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">¿Quieres más respaldo para tu arriendo?</h2>
      <p className="mt-1 text-sm text-slate-600">
        Servicios de terceros con <strong>costo aparte</strong> que tú decides tomar según tu necesidad: seguro de
        arrendamiento, estudio de crédito, autenticación notarial, cobranza y asesoría jurídica.
      </p>
      <Link
        href="/dashboard/aliados"
        className="mt-4 inline-flex rounded-lg border border-violet-500 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
      >
        Ver aliados disponibles →
      </Link>
    </section>
  );
}
