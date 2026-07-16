"use client";

import Link from "next/link";

/**
 * Navegación de regreso al **centro de control** del contrato, para no dispersar
 * al usuario con muchas pestañas. El listado y el estado de cada paso viven ahí.
 * (Evitamos la palabra "posventa": al usuario no le dice nada.)
 */
export function ExpedientePostWizardNav({ contractId }: { contractId: string }) {
  return (
    <nav className="mb-6 border-b border-slate-200 pb-3 text-sm">
      <Link
        href={`/dashboard/contracts/${contractId}/adicionales`}
        className="inline-flex items-center gap-1 font-medium text-violet-700 hover:text-violet-900"
      >
        ← Volver al panel del contrato
      </Link>
    </nav>
  );
}
