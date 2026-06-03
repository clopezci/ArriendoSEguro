import { createHash } from "node:crypto";

/**
 * Utilidades de observabilidad propia (alternativa ligera a Sentry).
 * Solo servidor: usa node:crypto. El cliente envía datos crudos y aquí se
 * normalizan, se enmascara PII y se calcula la huella para agrupar errores.
 */

export const ERROR_EVENTS_COLLECTION = "error_events";
export const USER_REPORTS_COLLECTION = "user_reports";

/**
 * Enmascara datos personales en textos que se guardan o se muestran en el
 * panel: correos y secuencias largas de dígitos (documentos, teléfonos).
 */
export function maskPii(input: string | null | undefined, maxLen = 4000): string {
  const t = (input ?? "").toString();
  return t
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[correo]")
    .replace(/\b\d{6,}\b/g, "[núm]")
    .slice(0, maxLen);
}

/**
 * Huella estable para agrupar errores equivalentes: normaliza números, hex y
 * URLs del mensaje y combina con el origen y el tipo. Así el «analizador»
 * agrega ocurrencias del mismo error en un solo documento con su contador.
 */
export function errorFingerprint(parts: { message: string; source?: string; kind?: string }): string {
  const normMessage = (parts.message ?? "")
    .replace(/0x[0-9a-f]+/gi, "0xH")
    .replace(/https?:\/\/[^\s)]+/gi, "url")
    .replace(/\b\d+\b/g, "N")
    .trim()
    .slice(0, 300);
  const source = (parts.source ?? "").split("?")[0]?.slice(0, 200) ?? "";
  const basis = `${parts.kind ?? "error"}|${normMessage}|${source}`;
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
}
