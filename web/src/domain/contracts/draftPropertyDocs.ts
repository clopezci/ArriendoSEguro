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

/**
 * Poder del apoderado (documento aparte del soporte de propiedad, pero guardado
 * en la misma colección con su propio `docType`). No es un "tipo de propiedad"
 * seleccionable: por eso vive fuera de PROPERTY_DOC_TYPES y se sube en su propia
 * casilla cuando el arrendador actúa como apoderado.
 */
export const PODER_DOC_TYPE = "poder";
export const PODER_DOC_LABEL = "Poder del apoderado";

/** Tipos válidos para los documentos de borrador (propiedad + poder). */
export const DRAFT_DOC_TYPES = [...PROPERTY_DOC_TYPES, PODER_DOC_TYPE] as const;

export function isDraftDocType(v: unknown): v is string {
  return typeof v === "string" && (DRAFT_DOC_TYPES as readonly string[]).includes(v);
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
