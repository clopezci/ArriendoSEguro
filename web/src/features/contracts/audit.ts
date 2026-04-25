type AuditMetadata = Record<string, string | number | boolean | null | undefined>;

export function auditEvent(eventName: string, metadata?: AuditMetadata): void {
  // Placeholder MVP: por ahora queda en consola para trazabilidad local.
  // TODO: enviar a endpoint/server-side audit cuando exista autenticación backend robusta.
  if (process.env.NODE_ENV !== "production") {
    console.info("[audit]", eventName, metadata ?? {});
  }
}

