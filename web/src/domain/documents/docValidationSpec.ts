/**
 * Especificación de validación por TIPO de documento soporte (cédula, carta
 * laboral, extracto, etc.). Define qué debe extraer la IA, contra qué se compara
 * y qué "tipo" debe ser el documento (para no aceptar cualquier papel con un
 * nombre). Módulo puro; el motor (`lib/documents/validateSupportDoc`) lo usa.
 */

export type DocValidationSpec = {
  /** Etiqueta legible del documento. */
  label: string;
  /** Descripción del tipo esperado (guía a la IA para confirmar que ES ese tipo). */
  typeDescription: string;
  /** ¿Se compara el NOMBRE del titular contra el de la parte? */
  comparesName: boolean;
  /** ¿Se compara el NÚMERO de documento (cédula/NIT/matrícula)? */
  comparesDocNumber: boolean;
  /** ¿Se exige que el documento efectivamente sea de este tipo (docKindMatches)? */
  checksKind: boolean;
};

/** Normaliza colilla_1..4 → colilla, extracto_1..3 → extracto, etc. */
function familyOf(docKey: string): string {
  if (/^colilla(_\d+)?$/.test(docKey)) return "colilla";
  if (/^extracto(_\d+)?$/.test(docKey)) return "extracto";
  if (docKey === "declaracion_renta_codeudor") return "declaracion_renta";
  if (/^otro(_\d+)?$/.test(docKey)) return "otro";
  return docKey;
}

const SPECS: Record<string, DocValidationSpec> = {
  cedula: {
    label: "Cédula",
    typeDescription:
      "cédula de ciudadanía colombiana (o de extranjería): documento de identidad con nombres, apellidos y NÚMERO de documento",
    comparesName: true,
    comparesDocNumber: true,
    checksKind: true,
  },
  carta_laboral: {
    label: "Carta laboral",
    typeDescription:
      "carta laboral: certificación de una empresa (con membrete/nombre de empresa) que indica el cargo, salario y antigüedad del empleado",
    comparesName: true,
    comparesDocNumber: false,
    checksKind: true,
  },
  colilla: {
    label: "Colilla de pago",
    typeDescription:
      "desprendible o colilla de pago de nómina: muestra empleador, periodo, devengados y deducciones del empleado",
    comparesName: true,
    comparesDocNumber: false,
    checksKind: true,
  },
  extracto: {
    label: "Extracto bancario",
    typeDescription:
      "extracto bancario o estado de cuenta de un BANCO: muestra el nombre del banco, número de cuenta y movimientos del titular",
    comparesName: true,
    comparesDocNumber: false,
    checksKind: true,
  },
  certificado_ingresos: {
    label: "Certificado de ingresos",
    typeDescription:
      "certificación de ingresos firmada por un contador público (con datos y tarjeta profesional del contador)",
    comparesName: true,
    comparesDocNumber: false,
    checksKind: true,
  },
  rut: {
    label: "RUT",
    typeDescription: "RUT de la DIAN: registro único tributario con el NIT y la razón social o nombre del titular",
    comparesName: true,
    comparesDocNumber: true,
    checksKind: true,
  },
  camara_comercio: {
    label: "Cámara de comercio",
    typeDescription:
      "certificado de existencia y representación / matrícula mercantil de una cámara de comercio (razón social, matrícula)",
    comparesName: true,
    comparesDocNumber: false,
    checksKind: true,
  },
  declaracion_renta: {
    label: "Declaración de renta",
    typeDescription: "declaración de renta ante la DIAN (formulario, año gravable, datos del declarante)",
    comparesName: true,
    comparesDocNumber: false,
    checksKind: true,
  },
  certificado_libertad: {
    label: "Certificado de tradición y libertad",
    typeDescription:
      "certificado de tradición y libertad: muestra la matrícula inmobiliaria y el/los propietario(s) del inmueble",
    comparesName: true,
    comparesDocNumber: false,
    checksKind: true,
  },
  referencia_comercial: {
    label: "Referencia comercial o personal",
    typeDescription: "carta de referencia comercial o personal (con datos de quien la emite)",
    comparesName: false,
    comparesDocNumber: false,
    checksKind: true,
  },
};

/** Devuelve la especificación de validación de una clave, o null si no se valida (p. ej. "otro_*"). */
export function getDocValidationSpec(docKey: string): DocValidationSpec | null {
  const fam = familyOf(docKey);
  if (fam === "otro") return null;
  return SPECS[fam] ?? null;
}
