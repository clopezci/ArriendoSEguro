import { createHash } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * Utilidades de observabilidad propia (alternativa ligera a Sentry).
 * Solo servidor: usa node:crypto y Firebase Admin. El cliente envía datos
 * crudos y aquí se normalizan, se enmascara PII y se calcula la huella para
 * agrupar errores equivalentes en un solo documento con su contador.
 */

export const ERROR_EVENTS_COLLECTION = "error_events";
export const USER_REPORTS_COLLECTION = "user_reports";

export type ErrorEventInput = {
  kind: string;
  message: string;
  source?: string | null;
  line?: number | null;
  column?: number | null;
  stack?: string | null;
  pageUrl?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
};

/**
 * Registra (o agrega) un error en `error_events`, agrupado por huella. Comparte
 * la lógica entre la captura de cliente (`/api/observability/client-error`) y la
 * de servidor (`logServerError`). Best-effort: el llamador debe envolver en try.
 */
export async function recordErrorEvent(firestore: Firestore, input: ErrorEventInput): Promise<void> {
  const fingerprint = errorFingerprint({
    message: input.message,
    source: input.source ?? undefined,
    kind: input.kind,
  });
  const now = new Date().toISOString();
  const ref = firestore.collection(ERROR_EVENTS_COLLECTION).doc(fingerprint);
  const snap = await ref.get();

  const common = {
    fingerprint,
    kind: input.kind,
    message: maskPii(input.message, 2000),
    source: input.source ? maskPii(input.source, 500) : null,
    line: input.line ?? null,
    column: input.column ?? null,
    stack: input.stack ? maskPii(input.stack, 4000) : null,
    lastPageUrl: input.pageUrl ? maskPii(input.pageUrl, 600) : null,
    lastUserAgent: input.userAgent ? input.userAgent.slice(0, 300) : null,
    appVersion: input.appVersion ?? null,
    lastSeenAt: now,
    lastSeenServer: FieldValue.serverTimestamp(),
    count: FieldValue.increment(1),
    resolved: snap.exists ? Boolean(snap.data()?.resolved) : false,
  };

  if (!snap.exists) {
    await ref.set({ ...common, firstSeenAt: now, firstSeenServer: FieldValue.serverTimestamp() });
  } else {
    await ref.set(common, { merge: true });
  }
}

/**
 * Registra un error ocurrido en el servidor (API routes) en el mismo analizador
 * que el panel admin muestra en la pestaña «Errores». Nunca lanza: si Firestore
 * no está o falla, simplemente no registra. `context` identifica el origen
 * (p. ej. "platform-payments/webhook").
 */
export async function logServerError(
  context: string,
  err: unknown,
  extra?: { pageUrl?: string | null },
): Promise<void> {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return;
    const baseMessage = err instanceof Error ? err.message : String(err);
    await recordErrorEvent(firestore, {
      kind: "server",
      message: `${context}: ${baseMessage}`,
      source: context,
      stack: err instanceof Error ? (err.stack ?? null) : null,
      pageUrl: extra?.pageUrl ?? null,
    });
  } catch {
    /* best-effort: el logger nunca debe romper la petición */
  }
}

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
