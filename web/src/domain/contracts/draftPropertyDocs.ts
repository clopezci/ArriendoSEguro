/**
 * Documentos que soportan la PROPIEDAD del inmueble, cargados por el DUEÑO en
 * etapa de borrador (antes de guardar la versión). Reemplazan la matrícula: el
 * dueño elige el tipo (certificado de tradición, servicios públicos, impuesto
 * predial, escritura u otro) y sube el archivo. Mismo patrón por URL firmada de
 * Storage que los soportes de invitados.
 */
export const DRAFT_PROPERTY_DOCS_COLLECTION = "draft_property_docs";
export const DRAFT_PROPERTY_DOC_MAX = 8;

export const PROPERTY_DOC_TYPES = ["tradicion", "servicios", "predial", "escritura", "otro"] as const;
export type PropertyDocType = (typeof PROPERTY_DOC_TYPES)[number];

export const PROPERTY_DOC_LABELS: Record<PropertyDocType, string> = {
  tradicion: "Certificado de tradición y libertad",
  servicios: "Recibo de servicios públicos",
  predial: "Impuesto predial",
  escritura: "Escritura pública",
  otro: "Otro documento de propiedad",
};

export function isPropertyDocType(v: unknown): v is PropertyDocType {
  return typeof v === "string" && (PROPERTY_DOC_TYPES as readonly string[]).includes(v);
}

/** Prefijo de Storage para los documentos de propiedad de un borrador. */
export function draftPropertyDocPrefix(contractDraftId: string): string {
  return `contracts/${contractDraftId}/draft-property-docs/`;
}

export type DraftPropertyDocRow = {
  id: string;
  docType: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
};
