"use client";

import { useEffect, useState } from "react";
import { IPC_REFERENCE } from "@/lib/domain/rent-law";

/**
 * IPC vigente para pantallas del cliente (renovación, revisión del contrato).
 * Sale de /api/annual-values (config del admin o revisión automática del DANE);
 * si falla la red, cae al valor de referencia del código para no bloquear.
 */
let cached: Promise<number> | null = null;

export function fetchCurrentIpcPercent(): Promise<number> {
  if (!cached) {
    cached = fetch("/api/annual-values")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { values?: { ipc?: { percent?: unknown } } } | null) => {
        const p = Number(j?.values?.ipc?.percent);
        return Number.isFinite(p) && p > -5 && p < 40 ? p : IPC_REFERENCE.percent;
      })
      .catch(() => {
        cached = null; // reintentar en la próxima pantalla
        return IPC_REFERENCE.percent;
      });
  }
  return cached;
}

export function useCurrentIpcPercent(): number {
  const [pct, setPct] = useState<number>(IPC_REFERENCE.percent);
  useEffect(() => {
    let alive = true;
    void fetchCurrentIpcPercent().then((p) => {
      if (alive) setPct(p);
    });
    return () => {
      alive = false;
    };
  }, []);
  return pct;
}
