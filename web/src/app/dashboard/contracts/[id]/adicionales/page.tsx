"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * La posventa se unificó en el ÚNICO centro de control con estilo bento
 * (`/nuevo/gestionar/[id]`), para que la experiencia sea la misma de extremo a
 * extremo (una cosa a la vez, tarjetas por fase). Esta ruta —canónica en toda la
 * app— ahora redirige allí; conserva compatibilidad con los enlaces existentes
 * («Volver a la posventa», menú del panel, WizardShell, etc.). Reutiliza los
 * MISMOS módulos/endpoints, así que nada funcional se pierde.
 */
export default function PosventaRedirect() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/nuevo/gestionar/${id}`);
  }, [id, router]);
  return <p className="p-6 text-sm text-slate-600">Abriendo la posventa…</p>;
}
