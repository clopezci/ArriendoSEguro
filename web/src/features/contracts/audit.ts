import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";

type AuditMetadata = Record<string, string | number | boolean | null | undefined>;

function maskEmailLike(value: string): string {
  const t = value.trim();
  const at = t.indexOf("@");
  if (at <= 1) return "***";
  return `${t[0]}***${t.slice(at)}`;
}

/** Evita datos personales completos y textos enormes en `audit_logs`. */
function sanitizeForAuditRecord(metadata: AuditMetadata | undefined): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(metadata ?? {})) {
    if (v === undefined) continue;
    const keyLower = k.toLowerCase();
    if (typeof v === "string") {
      let s = v.length > 800 ? `${v.slice(0, 800)}…` : v;
      if (keyLower.includes("email") || /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s)) {
        s = maskEmailLike(s);
      }
      out[k] = s;
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else {
      out[k] = String(v).slice(0, 400);
    }
  }
  return out;
}

/**
 * Trazabilidad operativa: consola en desarrollo y registro en Firestore cuando Admin está disponible.
 * No bloquea la petición HTTP ante fallos de escritura.
 */
export function auditEvent(eventName: string, metadata?: AuditMetadata): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[audit]", eventName, metadata ?? {});
  }

  const firestore = getAdminFirestore();
  if (!firestore) return;

  const at = new Date().toISOString();
  const payload = sanitizeForAuditRecord(metadata);

  void firestore
    .collection("audit_logs")
    .add({
      event: eventName,
      ...payload,
      at,
      createdAtServer: FieldValue.serverTimestamp(),
    })
    .catch((err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[audit] Firestore write failed", eventName, err);
      }
    });
}
