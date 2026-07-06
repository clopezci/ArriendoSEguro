"use client";

import { useEffect, useState } from "react";
import { freeTierEnabled } from "@/lib/config";

// Se duplican aquí para no importar el módulo de servidor (free-tier.ts usa
// firebase-admin) dentro del bundle de cliente.
const DEFAULT_LABEL = "Gratis por tiempo limitado";
const DEFAULT_MESSAGE =
  "Crea e imprime tu contrato de arrendamiento. Sale con una marca discreta «arriendoseguro.app» y recomendaciones; es utilizable.";

export type FreeTierState = {
  enabled: boolean;
  label: string;
  message: string;
  loading: boolean;
};

/**
 * Config del tier gratis para componentes de cliente. Mientras carga usa el
 * valor de la variable de entorno (compatibilidad, sin parpadeo de estado), y
 * luego lo reemplaza con la configuración vigente en `app_settings/free_tier`.
 */
export function useFreeTier(): FreeTierState {
  const [state, setState] = useState<FreeTierState>({
    enabled: freeTierEnabled,
    label: DEFAULT_LABEL,
    message: DEFAULT_MESSAGE,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/free-tier");
        const j = (await res.json()) as {
          success?: boolean;
          enabled?: boolean;
          label?: string;
          message?: string;
        };
        if (!cancelled && res.ok && j.success) {
          setState({
            enabled: Boolean(j.enabled),
            label: (j.label ?? "").trim() || DEFAULT_LABEL,
            message: (j.message ?? "").trim() || DEFAULT_MESSAGE,
            loading: false,
          });
        } else if (!cancelled) {
          setState((s) => ({ ...s, loading: false }));
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
