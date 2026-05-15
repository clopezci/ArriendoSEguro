/**
 * Auditoría segura para componentes cliente: solo consola en desarrollo.
 * En servidor usar `@/features/contracts/audit-server` (Firestore Admin).
 */
export type AuditMetadata = Record<string, string | number | boolean | null | undefined>;

export function auditEvent(eventName: string, metadata?: AuditMetadata): void {
  if (process.env.NODE_ENV !== "production") {
    console.info("[audit]", eventName, metadata ?? {});
  }
}
