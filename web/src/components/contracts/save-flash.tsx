"use client";

import { useEffect, useState } from "react";

/**
 * Aviso "Guardado ✓" reutilizable para el final de cada bloque del asistente.
 *
 * Uso: en el `onSubmit` de una página, en vez de `router.push(next)` llama a
 * `flashSaved(() => router.push(next))`. Se muestra el aviso ~0.8s y luego se
 * ejecuta la navegación, de modo que el usuario ve la confirmación antes de
 * pasar al siguiente bloque. El `<SaveFlash/>` se monta una vez en el
 * WizardShell, así aparece en todas las páginas sin tocarlas una por una.
 */

const EVENT = "as:saved";
const VISIBLE_MS = 800;

/** Dispara el aviso "Guardado ✓" y, tras una breve pausa, ejecuta `next`. */
export function flashSaved(next?: () => void, message = "Guardado ✓"): void {
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { message } }));
  } catch {
    /* SSR / sin window: seguimos con la navegación igualmente */
  }
  if (next) {
    if (typeof window === "undefined") {
      next();
    } else {
      window.setTimeout(next, VISIBLE_MS);
    }
  }
}

export function SaveFlash() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    function onSaved(e: Event) {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setMsg(detail?.message ?? "Guardado ✓");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 1600);
    }
    window.addEventListener(EVENT, onSaved as EventListener);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(EVENT, onSaved as EventListener);
    };
  }, []);

  if (!msg) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg"
    >
      {msg}
    </div>
  );
}
