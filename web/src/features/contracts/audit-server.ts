import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent as auditEventClient, type AuditMetadata } from "@/features/contracts/audit";

export type { AuditMetadata };

function maskEmailLike(value: string): string {
  const t = value.trim();
  const at = t.indexOf("@");
  if (at <= 1) return "***";
  return `${t[0]}***${t.slice(at)}`;
}

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
 * Trazabilidad en servidor: consola (dev) + `audit_logs` en Firestore cuando Admin está disponible.
 */
export function auditEvent(eventName: string, metadata?: AuditMetadata): void {
  auditEventClient(eventName, metadata);

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
