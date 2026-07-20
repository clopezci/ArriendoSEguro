"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { INTRO_PROMO_TITLE, INTRO_PROMO_INCLUDES } from "@/lib/product-pricing";

const INTRO_PROMO_DISMISS_KEY = "promo_intro_dismissed";

/**
 * Banner de la promoción de introducción, como PUBLICIDAD INTERNA cerrable.
 * Reglas de uso: puede aparecer en varias partes (inicio, etc.), pero NUNCA en
 * el login ni en la pasarela de pago (ahí el usuario solo debe acceder/pagar sin
 * distracción). Dice explícitamente TODO lo que incluye el contrato, no solo la
 * firma. Al cerrarlo, se recuerda en localStorage y no vuelve a molestar.
 */
export function IntroPromoBanner({ className = "" }: { className?: string }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(INTRO_PROMO_DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      /* localStorage no disponible: lo mostramos */
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(INTRO_PROMO_DISMISS_KEY, "1");
    } catch {
      /* sin persistencia: al menos se oculta esta sesión */
    }
  }

  if (dismissed) return null;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border-2 border-[#FF6B4A]/30 bg-gradient-to-br from-[#FFF4EF] to-[#FFE9DF] p-4 ${className}`}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ocultar esta promoción"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/70 hover:text-slate-700"
      >
        ✕
      </button>
      <p className="pr-8 text-sm font-black text-[#C7361A]">🎉 {INTRO_PROMO_TITLE}</p>
      <p className="mt-1 text-[13px] text-slate-700">
        Pago único por contrato (no mensual). <strong>Incluye todo esto:</strong>
      </p>
      <ul className="mt-2 grid gap-x-4 gap-y-1 text-[13px] text-slate-700 sm:grid-cols-2">
        {INTRO_PROMO_INCLUDES.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <span className="mt-0.5 text-emerald-600" aria-hidden="true">
              ✓
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-slate-600">
        Y tu <strong>segundo contrato puede ser GRATIS</strong> si invitas a 3 personas y al menos 2 usan la app.
      </p>
      <Link
        href="/dashboard/plans"
        className="mt-3 inline-flex items-center gap-1 rounded-xl bg-[#FF6B4A] px-4 py-2 text-sm font-bold text-white shadow-md shadow-orange-500/30 transition hover:brightness-105"
      >
        Ver plan y activar →
      </Link>
    </section>
  );
}
