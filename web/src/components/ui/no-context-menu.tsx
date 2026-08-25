"use client";

import { useEffect } from "react";

/**
 * Capa COSMÉTICA: desactiva el menú del click derecho en la mayor parte de la
 * página (para desalentar "ver código/inspeccionar" casual). NO es seguridad
 * real: el código de una web siempre es visible con las herramientas de
 * desarrollador. La protección de verdad está en el servidor (auth, permisos,
 * validación). Dejamos el menú en campos de texto para que se pueda copiar/pegar.
 */
export function NoContextMenu() {
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (t?.isContentEditable ?? false)) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);
  return null;
}
