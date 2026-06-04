"use client";

import { useAuth } from "@/contexts/auth-context";
import { buildAuthHeaders } from "@/lib/auth/authHeaders";
import {
  getDraft,
  type ContractDraft,
} from "@/features/contracts/wizard-state";
import { pullServerDraftsIntoLocal } from "@/features/contracts/draft-server-sync";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Hook de protección para las pantallas internas del wizard.
 *
 * Antes leía el estado de acceso desde `localStorage` (`getUserAccessStatus`),
 * lo cual generaba una desincronización con Firestore: si el Plan Plus se
 * activaba desde el módulo admin o desde otra pestaña, el localStorage seguía
 * marcando "pending_payment" y el wizard rebotaba al usuario a `/dashboard/leases`.
 *
 * Ahora consulta `/api/access/entitlements/me`, que es la fuente de verdad
 * (Firestore). Si plus o demo están activos, se permite continuar.
 */
export function useDraftGuard(id: string) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "blocked">("loading");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (loading) return;
      if (!user) {
        router.replace(`/ingresar?redirect=/dashboard/contracts/${id}/contract-type`);
        return;
      }
      try {
        const res = await fetch("/api/access/entitlements/me", {
          headers: { ...(await buildAuthHeaders(user)) },
        });
        const data = (await res.json()) as {
          success?: boolean;
          plusActive?: boolean;
          demoActive?: boolean;
        };
        if (cancelled) return;
        const allowed = res.ok && data.success && (data.plusActive || data.demoActive);
        if (!allowed) {
          router.replace("/dashboard/leases");
          return;
        }
      } catch {
        if (cancelled) return;
        // Si no podemos consultar entitlements en este momento, no bloqueamos
        // al usuario que ya está dentro de su propio expediente: redirigirlo
        // a "Mis arriendos" lo dejaría con la misma pantalla rota. La acción
        // realmente sensible (guardar versión, generar PDF, firmar) ya valida
        // permisos en el backend.
      }
      if (cancelled) return;
      let found = getDraft(id);
      // Deep-link desde otro dispositivo: si no está en localStorage, intenta
      // traerlo del servidor antes de bloquear.
      if (!found) {
        const pulled = await pullServerDraftsIntoLocal();
        if (cancelled) return;
        if (pulled !== null) found = getDraft(id);
      }
      if (!found || found.userId !== user.uid) {
        setState("blocked");
        return;
      }
      setDraft(found);
      setState("ready");
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [id, user, loading, router]);

  return { draft, state };
}

export function StepNav({
  backHref,
  backLabel = "Anterior",
  nextHref,
  nextLabel = "Guardar y continuar",
}: {
  backHref?: string;
  backLabel?: string;
  nextHref?: string;
  nextLabel?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {backHref && (
        <Link
          href={backHref}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:border-violet-500"
        >
          {backLabel}
        </Link>
      )}
      {nextHref && (
        <button
          form="wizard-form"
          type="submit"
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
