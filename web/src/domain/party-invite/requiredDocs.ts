/**
 * Catálogo de DOCUMENTOS REQUERIDOS que el DUEÑO puede exigir al inquilino y/o
 * al codeudor. El dueño elige libremente cuáles pide; cada documento elegido se
 * convierte en una "casilla nombrada" de subida, tanto en el enlace que llena el
 * invitado como cuando el propio dueño sube en su nombre. Así se asegura la
 * CANTIDAD de documentos requeridos (que sean los correctos depende de la
 * revisión del dueño y del juramento final).
 */

export type RequiredDocRole = "tenant" | "codebtor";

export type RequiredDocDef = {
  key: string;
  label: string;
  /** Roles a los que aplica este documento en el catálogo. */
  roles: RequiredDocRole[];
};

/** Catálogo completo. El dueño selecciona los que apliquen a cada parte. */
export const REQUIRED_DOC_CATALOG: RequiredDocDef[] = [
  { key: "cedula", label: "Cédula (ambas caras)", roles: ["tenant", "codebtor"] },
  { key: "carta_laboral", label: "Carta laboral", roles: ["tenant", "codebtor"] },
  { key: "colilla_1", label: "Colilla de pago 1", roles: ["tenant", "codebtor"] },
  { key: "colilla_2", label: "Colilla de pago 2", roles: ["tenant", "codebtor"] },
  { key: "colilla_3", label: "Colilla de pago 3", roles: ["tenant", "codebtor"] },
  { key: "colilla_4", label: "Colilla de pago 4", roles: ["tenant", "codebtor"] },
  { key: "extracto_1", label: "Extracto bancario 1", roles: ["tenant", "codebtor"] },
  { key: "extracto_2", label: "Extracto bancario 2", roles: ["tenant", "codebtor"] },
  { key: "extracto_3", label: "Extracto bancario 3", roles: ["tenant", "codebtor"] },
  { key: "certificado_ingresos", label: "Certificado de ingresos (contador)", roles: ["tenant", "codebtor"] },
  { key: "rut", label: "RUT", roles: ["tenant", "codebtor"] },
  { key: "camara_comercio", label: "Cámara de comercio (independientes)", roles: ["tenant", "codebtor"] },
  { key: "declaracion_renta", label: "Declaración de renta", roles: ["tenant", "codebtor"] },
  { key: "certificado_libertad", label: "Certificado de tradición y libertad (propiedad)", roles: ["tenant", "codebtor"] },
  { key: "referencia_comercial", label: "Referencia comercial o personal", roles: ["tenant", "codebtor"] },
  // Lo consulta y adjunta el TITULAR (la persona), nunca el dueño (Ley 1581).
  // Se solicita desde el paso de verificación, no desde la lista manual.
  { key: "datacredito", label: "Reporte de DataCrédito (lo aporta el titular)", roles: ["tenant", "codebtor"] },
  { key: "declaracion_renta_codeudor", label: "Declaración de renta del codeudor", roles: ["codebtor"] },
  { key: "otro_1", label: "Otro documento 1", roles: ["tenant", "codebtor"] },
  { key: "otro_2", label: "Otro documento 2", roles: ["tenant", "codebtor"] },
];

const KEY_TO_DEF: Record<string, RequiredDocDef> = Object.fromEntries(REQUIRED_DOC_CATALOG.map((d) => [d.key, d]));

/** Documentos del catálogo aplicables a un rol. */
export function requiredDocCatalogForRole(role: RequiredDocRole): RequiredDocDef[] {
  return REQUIRED_DOC_CATALOG.filter((d) => d.roles.includes(role));
}

/** Etiqueta legible de una clave (o la propia clave si no está en el catálogo). */
export function requiredDocLabel(key: string): string {
  return KEY_TO_DEF[key]?.label ?? key;
}

/** ¿La clave existe en el catálogo? (para validar entradas de red). */
export function isRequiredDocKey(key: unknown): key is string {
  return typeof key === "string" && key in KEY_TO_DEF;
}

/** Filtra y de-duplica una lista de claves recibida (defensivo). */
export function sanitizeRequiredDocs(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<string>();
  for (const k of keys) if (isRequiredDocKey(k)) seen.add(k);
  return [...seen];
}
