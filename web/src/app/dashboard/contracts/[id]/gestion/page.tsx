"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * La "gestión del arriendo" se unificó en el ÚNICO centro de control de posventa
 * (`adicionales`) para no tener hubs paralelos que confundan. Esta ruta ahora
 * solo redirige allí (conserva enlaces antiguos que aún apunten aquí).
 */
export default function GestionRedirect() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/contracts/${id}/adicionales`);
  }, [id, router]);
  return <p className="p-6 text-sm text-slate-600">Redirigiendo a la posventa…</p>;
}
