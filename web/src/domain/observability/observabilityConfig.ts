/**
 * Configuración de alertas de errores y estado del servicio (editable desde
 * `/admin`). Módulo **puro** (sin Firebase ni red).
 *
 * Umbral por defecto = **1** (el mínimo): se alerta desde el primer error
 * reciente para enterarnos antes que el usuario. El "cooldown" evita repetir el
 * aviso muy seguido.
 */

export const OBSERVABILITY_CONFIG_COLLECTION = "app_settings";
export const OBSERVABILITY_CONFIG_DOC_ID = "observability_config";

export const STATUS_INCIDENTS_COLLECTION = "status_incidents";

export interface ObservabilityConfig {
  errorAlertEnabled: boolean;
  /** Nº de errores recientes (distintos) a partir del cual se alerta. Mínimo 1. */
  errorAlertThreshold: number;
  /** Ventana de tiempo considerada "reciente", en minutos. */
  errorAlertWindowMinutes: number;
  /** Tiempo mínimo entre avisos, en minutos (evita spam). */
  errorAlertCooldownMinutes: number;
  lastAlertAt?: string;
  updatedAt?: string;
  updatedByEmail?: string;
}

export function defaultObservabilityConfig(): ObservabilityConfig {
  return {
    errorAlertEnabled: true,
    errorAlertThreshold: 1, // mínimo: alertar desde el primer error reciente
    errorAlertWindowMinutes: 60,
    errorAlertCooldownMinutes: 180,
  };
}

/**
 * Resuelve la config de forma **tolerante por campo**: un valor inválido cae a
 * su default sin descartar los demás. No agrega claves opcionales vacías.
 */
export function resolveObservabilityConfig(stored: unknown): ObservabilityConfig {
  const base = defaultObservabilityConfig();
  const o = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const intInRange = (v: unknown, min: number, max: number, fallback: number): number => {
    const n = typeof v === "number" ? v : NaN;
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };

  const config: ObservabilityConfig = {
    errorAlertEnabled: typeof o.errorAlertEnabled === "boolean" ? o.errorAlertEnabled : base.errorAlertEnabled,
    errorAlertThreshold: intInRange(o.errorAlertThreshold, 1, 1000, base.errorAlertThreshold),
    errorAlertWindowMinutes: intInRange(o.errorAlertWindowMinutes, 5, 1440, base.errorAlertWindowMinutes),
    errorAlertCooldownMinutes: intInRange(o.errorAlertCooldownMinutes, 15, 10080, base.errorAlertCooldownMinutes),
  };
  if (typeof o.lastAlertAt === "string") config.lastAlertAt = o.lastAlertAt;
  if (typeof o.updatedAt === "string") config.updatedAt = o.updatedAt;
  if (typeof o.updatedByEmail === "string") config.updatedByEmail = o.updatedByEmail;
  return config;
}

/**
 * Decide si debe enviarse el aviso de errores ahora.
 * @param recentDistinctErrors  nº de errores (huellas) activos dentro de la ventana
 * @param nowMs                 instante actual (ms)
 */
export function shouldSendErrorAlert(
  config: ObservabilityConfig,
  recentDistinctErrors: number,
  nowMs: number,
): { send: boolean; reason: string } {
  if (!config.errorAlertEnabled) return { send: false, reason: "alertas deshabilitadas" };
  if (recentDistinctErrors < config.errorAlertThreshold) {
    return { send: false, reason: "por debajo del umbral" };
  }
  if (config.lastAlertAt) {
    const last = Date.parse(config.lastAlertAt);
    if (Number.isFinite(last) && nowMs - last < config.errorAlertCooldownMinutes * 60_000) {
      return { send: false, reason: "en período de enfriamiento" };
    }
  }
  return { send: true, reason: "umbral superado" };
}
