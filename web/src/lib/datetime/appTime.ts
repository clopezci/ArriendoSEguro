/**
 * Formateo de fecha/hora para MOSTRAR (evidencia de firma, anexos, tablas).
 *
 * Regla de oro: las marcas de tiempo se GUARDAN en UTC (ISO 8601, inequívoco),
 * pero se MUESTRAN en la zona horaria del contrato. Por defecto Colombia
 * (`America/Bogota` = GMT-5). Siempre incluimos la etiqueta de zona (p. ej.
 * "GMT-5") para que la evidencia no dependa de dónde corra el servidor.
 *
 * `toLocaleString("es-CO")` NO fija la zona: usa la del entorno (en el servidor,
 * UTC). Ese era el bug — las firmas salían en hora del servidor, no de Colombia.
 *
 * Expansión a otros países: pasa `timeZone` (la del inmueble/contrato) y todo el
 * formateo respeta esa zona. Sin parámetro, cae a `APP_TIME_ZONE` o Colombia.
 */
export const DEFAULT_APP_TIME_ZONE = "America/Bogota";

export function resolveAppTimeZone(timeZone?: string | null): string {
  const explicit = (timeZone ?? "").trim();
  if (explicit) return explicit;
  const env = process.env.APP_TIME_ZONE?.trim();
  return env || DEFAULT_APP_TIME_ZONE;
}

function formatWith(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    // "shortOffset" da "GMT-5" (consistente en todo país); "short" daría "COT".
    timeZoneName: "shortOffset",
  }).format(d);
}

/**
 * Fecha y hora completas con etiqueta de zona (para evidencia legal).
 * Ej.: "15/07/2026, 14:30:05 GMT-5". Devuelve `fallback` si el valor es inválido.
 */
export function formatAppDateTime(
  value: string | number | Date | null | undefined,
  options?: { timeZone?: string | null; fallback?: string },
): string {
  const fallback = options?.fallback ?? "-";
  if (value == null || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const timeZone = resolveAppTimeZone(options?.timeZone);
  try {
    return formatWith(d, timeZone);
  } catch {
    // Zona inválida (datos ICU): caemos a UTC, pero SIEMPRE etiquetado.
    return formatWith(d, "UTC");
  }
}

/** Solo fecha (sin hora), en la zona del contrato. Ej.: "15/07/2026". */
export function formatAppDate(
  value: string | number | Date | null | undefined,
  options?: { timeZone?: string | null; fallback?: string },
): string {
  const fallback = options?.fallback ?? "-";
  if (value == null || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const timeZone = resolveAppTimeZone(options?.timeZone);
  try {
    return new Intl.DateTimeFormat("es-CO", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  } catch {
    return new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  }
}
