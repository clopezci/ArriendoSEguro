"use client";

import Link from "next/link";

/**
 * Navegación de posventa: un único enlace de regreso al **centro de control**
 * (la posventa del contrato), para no dispersar al usuario con muchas pestañas.
 * El listado y el estado de cada paso viven en ese hub.
 */
export function ExpedientePostWizardNav({ contractId }: { contractId: string }) {
  return (
    <nav className="mb-6 border-b border-slate-200 pb-3 text-sm">
      <Link
        href={`/dashboard/contracts/${contractId}/adicionales`}
        className="inline-flex items-center gap-1 font-medium text-violet-700 hover:text-violet-900"
      >
        ← Volver a la posventa del contrato
      </Link>
    </nav>
  );
}
