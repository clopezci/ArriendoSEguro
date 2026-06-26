"use client";

/** Botón para imprimir / guardar como PDF la hoja de la plantilla. */
export function PrintButton({ label = "Imprimir / Guardar como PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-500"
    >
      {label}
    </button>
  );
}
