import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

/**
 * Registro de EVENTOS de producto para la contabilidad de la innovación (Lean):
 * embudo por cohortes, abandono con motivo, drop-off del asistente, etc.
 * Colección liviana `analytics_events`. Best-effort: nunca lanza; si Firestore
 * no está, no hace nada. NO guardar PII en `props` (solo etiquetas/números).
 */
export const ANALYTICS_EVENTS_COLLECTION = "analytics_events";

/** Nombres de evento permitidos (evita basura/eventos falsos desde el cliente). */
export const ALLOWED_EVENTS = new Set<string>([
  "page_abandon",       // salió de una página del embudo sin actuar (aunque no dé motivo)
  "app_return",         // volvió a la app tras haberse ido (para medir retorno)
  "abandon_reason",     // marcó POR QUÉ se fue (props.reason)
  "abandon_dismissed",  // cerró la micro-encuesta sin responder
  "nuevo_started",      // entró al asistente
  "nuevo_step",         // alcanzó un paso (props.index, props.step)
  "nuevo_review",       // llegó a la revisión final
  "nuevo_completed",    // terminó el contrato
  "reached_payment",    // llegó a la pasarela de pago
  "account_cancel_reason", // motivo de baja de cuenta (props.reason)
  "cta_click",          // clic en un llamado a la acción (props.cta)
]);

/** Deja solo valores primitivos, recorta longitudes y limita el nº de claves. */
function sanitizeProps(props: unknown): Record<string, string | number | boolean> | null {
  if (!props || typeof props !== "object") return null;
  const out: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
    if (n >= 12) break;
    const key = String(k).slice(0, 40);
    if (typeof v === "string") out[key] = v.slice(0, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
    else continue;
    n += 1;
  }
  return Object.keys(out).length ? out : null;
}

export async function logEvent(input: {
  name: string;
  uid?: string | null;
  anonId?: string | null;
  props?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<boolean> {
  const db = getAdminFirestore();
  if (!db) return false;
  const name = String(input.name ?? "").trim().slice(0, 64);
  if (!name || !ALLOWED_EVENTS.has(name)) return false;
  try {
    const now = new Date();
    await db.collection(ANALYTICS_EVENTS_COLLECTION).add({
      name,
      at: now.toISOString(),
      day: now.toISOString().slice(0, 10),
      createdAt: FieldValue.serverTimestamp(),
      uid: input.uid ?? null,
      anonId: (input.anonId ?? "").toString().slice(0, 64) || null,
      props: sanitizeProps(input.props),
      ip: input.ip ?? null,
      ua: (input.userAgent ?? "").toString().slice(0, 300) || null,
    });
    return true;
  } catch {
    return false;
  }
}
