/**
 * Documentos de propiedad / poder del inmueble (escritura, certificado de
 * libertad, **poder autenticado** cuando el arrendador actúa como apoderado).
 *
 * Mismo patrón que los soportes del codeudor: subida a Firebase Storage vía URL
 * firmada, registro en Firestore y validación de la ruta. Módulo **puro**.
 */

export const PROPERTY_DOC_TYPES = ["poder", "escritura", "certificado_libertad", "otro"] as const;
export type PropertyDocType = (typeof PROPERTY_DOC_TYPES)[number];

export const PROPERTY_DOC_TYPE_LABELS: Record<PropertyDocType, string> = {
  poder: "Poder autenticado",
  escritura: "Escritura pública",
  certificado_libertad: "Certificado de libertad y tradición",
  otro: "Otro documento",
};

export const PROPERTY_DOC_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
export const PROPERTY_DOC_MAX_PER_TYPE = 5;
export const PROPERTY_DOC_ALLOWED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export function isPropertyDocType(v: unknown): v is PropertyDocType {
  return typeof v === "string" && (PROPERTY_DOC_TYPES as readonly string[]).includes(v);
}

export function safePropertyDocFilename(name: string): string {
  const base = (name ?? "").split(/[\\/]/).pop() ?? "documento";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "documento";
}

export function propertyDocObjectPath(
  contractId: string,
  docType: PropertyDocType,
  stamp: number,
  filename: string,
): string {
  return `contracts/${contractId}/property-documents/${docType}/${stamp}-${safePropertyDocFilename(filename)}`;
}

/**
 * Verifica que una ruta `gs://bucket/...` corresponda al contrato y al tipo de
 * documento esperados. Devuelve el objectPath o null.
 */
export function assertValidPropertyDocGsPath(
  gsPath: string,
  opts: { expectedBucket: string; contractId: string; docType: PropertyDocType },
): { objectPath: string } | null {
  const prefix = `gs://${opts.expectedBucket}/`;
  if (!gsPath.startsWith(prefix)) return null;
  const objectPath = gsPath.slice(prefix.length);
  const expectedDir = `contracts/${opts.contractId}/property-documents/${opts.docType}/`;
  if (!objectPath.startsWith(expectedDir)) return null;
  // Evita path traversal.
  if (objectPath.includes("..")) return null;
  return { objectPath };
}
