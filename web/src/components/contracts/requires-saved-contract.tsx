"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export type SavedContractLease = {
  monthlyRent?: number;
  paymentDueDay?: number;
  termMonths?: number;
  startDate?: string;
};

export type SavedContractState = {
  status: "loading" | "saved" | "unsaved" | "error";
  currentVersionId: string | null;
  contractStatus: string | null;
  lease: SavedContractLease | null;
};

/**
 * Consulta `/api/contracts/latest-version` y dice si el contrato YA tiene una
 * versión guardada en el servidor (`currentVersionId`). Endpoint liviano y seguro
 * (solo expone `status`/`currentVersionId`/`lease` básico).
 */
export function useSavedContract(id: string): SavedContractState {
  const [state, setState] = useState<SavedContractState>({
    status: "loading",
    currentVersionId: null,
    contractStatus: null,
    lease: null,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/contracts/latest-version?contractId=${encodeURIComponent(id)}`);
        const data = (await res.json()) as {
          success?: boolean;
          contract?: { currentVersionId?: string; status?: string } | null;
          version?: { id?: string; contractPayload?: { lease?: SavedContractLease } } | null;
        };
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          setState({ status: "error", currentVersionId: null, contractStatus: null, lease: null });
          return;
        }
        const currentVersionId = data.version?.id ?? data.contract?.currentVersionId ?? null;
        setState({
          status: currentVersionId ? "saved" : "unsaved",
          currentVersionId,
          contractStatus: data.contract?.status ?? null,
          lease: data.version?.contractPayload?.lease ?? null,
        });
      } catch {
        if (!cancelled) {
          setState({ status: "error", currentVersionId: null, contractStatus: null, lease: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}

/** Tarjeta de bloqueo cuando el contrato aún no se ha guardado. */
export function SavedContractGate({ id }: { id: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 p-6 text-center shadow-[0_10px_24px_rgba(245,158,11,0.2)]">
      <p className="text-3xl" aria-hidden="true">
        🔒
      </p>
      <h2 className="mt-1 text-lg font-semibold text-amber-800">
        Este paso se habilita cuando guardes tu contrato
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-900">
        Primero completa los datos y pulsa <strong>«Guardar mi contrato»</strong> en la vista previa. Después podrás
        configurar el método de pago, registrar novedades y subir documentos.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link
          href={`/dashboard/contracts/${id}/preview`}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.35)]"
        >
          Ir a guardar mi contrato
        </Link>
        <Link
          href={`/dashboard/contracts/${id}/adicionales`}
          className="rounded-lg border border-violet-500 px-4 py-2 text-sm font-medium text-violet-700"
        >
          Centro de adicionales
        </Link>
      </div>
    </div>
  );
}

/**
 * Envuelve contenido de posventa: si el contrato no tiene versión guardada,
 * muestra la tarjeta de bloqueo en vez de la pantalla (que saldría rota, p. ej.
 * "Canon $0" o "no hay contrato guardado"). En `error` no bloquea (mismo criterio
 * tolerante que `useDraftGuard`).
 */
export function RequiresSavedContract({ id, children }: { id: string; children: ReactNode }) {
  const sc = useSavedContract(id);
  if (sc.status === "loading") {
    return <p className="text-sm text-slate-600">Cargando…</p>;
  }
  if (sc.status === "unsaved") {
    return <SavedContractGate id={id} />;
  }
  return <>{children}</>;
}
