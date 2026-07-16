"use client";

import Link from "next/link";

/**
 * Navegación de regreso al **centro de control** del contrato, para no dispersar
 * al usuario con muchas pestañas. El listado y el estado de cada paso viven ahí.
 * (Evitamos la palabra "posventa": al usuario no le dice nada.)
 */
export function ExpedientePostWizardNav({ contractId }: { contractId: string }) {
  return (
    <nav className="mb-6 text-sm">
      <Link
        href={`/nuevo/gestionar/${contractId}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-[#5646E5] hover:underline"
      >
        ← Administra tu arriendo
      </Link>
    </nav>
  );
}
