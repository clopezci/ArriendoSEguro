"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * El hub de "Evidencias" se unificó en el ÚNICO centro de control de posventa
 * (`adicionales`), donde ya están soportes, documentos, notaría, pagos,
 * inventario/acta y el paquete ZIP. Esta ruta ahora solo redirige allí.
 */
export default function EvidenciasRedirect() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/contracts/${id}/adicionales`);
  }, [id, router]);
  return <p className="p-6 text-sm text-slate-600">Redirigiendo a la posventa…</p>;
}
