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
// Tiempo que se muestra "Guardado ✓" antes de navegar. Se bajó de 800→400 ms
// para que el paso siguiente empiece a cargar antes (menos espera percibida).
const VISIBLE_MS = 400;

/**
 * Dispara el aviso "Guardado ✓" y, tras una breve pausa, ejecuta `next`.
 * Justo antes de navegar cambia el aviso a "Avanzando…" de forma persistente,
 * para que —si cargar el siguiente paso tarda— el usuario vea que algo está
 * pasando. Ese aviso desaparece solo cuando el nuevo paso monta su `<SaveFlash/>`.
 */
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
      window.setTimeout(() => {
        try {
          window.dispatchEvent(
            new CustomEvent(EVENT, { detail: { message: "Avanzando…", persist: true } }),
          );
        } catch {
          /* noop */
        }
        next();
      }, VISIBLE_MS);
    }
  }
}

export function SaveFlash() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    function onSaved(e: Event) {
      const detail = (e as CustomEvent<{ message?: string; persist?: boolean }>).detail;
      setMsg(detail?.message ?? "Guardado ✓");
      window.clearTimeout(timer);
      // "Avanzando…" (persist) no se auto-oculta: se limpia cuando el nuevo paso
      // monta un `<SaveFlash/>` nuevo. Los avisos normales sí se ocultan solos.
      if (!detail?.persist) {
        timer = window.setTimeout(() => setMsg(null), 1600);
      }
    }
    window.addEventListener(EVENT, onSaved as EventListener);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(EVENT, onSaved as EventListener);
    };
  }, []);

  if (!msg) return null;
  const navigating = msg === "Avanzando…";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white shadow-lg ${
        navigating ? "border-violet-300 bg-violet-600" : "border-emerald-300 bg-emerald-600"
      }`}
    >
      {navigating && (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
      )}
      {msg}
    </div>
  );
}
