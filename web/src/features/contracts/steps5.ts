/**
 * Modelo ÚNICO de los 5 pasos del recorrido (rediseño 2026-07).
 *
 *   1. Arma tu expediente   (tipo, dueño, propiedad, inquilino, codeudor)
 *   2. Condiciones          (términos, servicios, cláusulas, documentos)
 *   3. Revisión y vista previa
 *   4. Firma de las partes
 *   5. Acta de entrega e inventario
 *
 * La **posventa** (pagos, novedades, alertas, calificación) va APARTE y SIN número.
 *
 * Módulo puro (sin React) para poder testearlo y reutilizarlo en el stepper y en
 * las páginas. El `currentStep` histórico del asistente (1..10) se mapea aquí a
 * uno de los 5 macro-pasos, para no tener que tocar cada página en esta fase.
 */

export type MacroStepKey = "expediente" | "condiciones" | "revision" | "firma" | "acta";

export type MacroStep = {
  key: MacroStepKey;
  /** Número visible (1..5). */
  number: number;
  label: string;
  hint: string;
  /** Ruta de entrada del macro-paso (primera sub-página), relativa al contrato. */
  entry: (contractId: string) => string;
};

const base = (id: string) => `/dashboard/contracts/${id}`;

export const MACRO_STEPS: MacroStep[] = [
  {
    key: "expediente",
    number: 1,
    label: "Arma tu expediente",
    hint: "Quién diligencia, y datos del dueño, la propiedad, el inquilino y el codeudor.",
    entry: (id) => `${base(id)}/contract-type`,
  },
  {
    key: "condiciones",
    number: 2,
    label: "Condiciones",
    hint: "Canon, pago, fechas, servicios, cláusulas y documentos de soporte.",
    entry: (id) => `${base(id)}/terms`,
  },
  {
    key: "revision",
    number: 3,
    label: "Revisión y vista previa",
    hint: "Revisa todos los datos y la estructura completa del contrato.",
    entry: (id) => `${base(id)}/review`,
  },
  {
    key: "firma",
    number: 4,
    label: "Firma",
    hint: "Firma de las partes con respaldo legal.",
    entry: (id) => `${base(id)}/firma`,
  },
  {
    key: "acta",
    number: 5,
    label: "Acta e inventario",
    hint: "Fecha de entrega, inventario con fotos y acta para ambas partes.",
    entry: (id) => `${base(id)}/inventory`,
  },
];

/** Paso especial (sin número): posventa. */
export const POSTVENTA_STEP = {
  key: "posventa" as const,
  label: "Gestiona tu arriendo",
  hint: "Pagos, recordatorios, novedades y calificación, tras firmar.",
  entry: (id: string) => `${base(id)}/adicionales`,
};

/** Mapa del índice histórico del asistente (1..10) → macro-paso. */
const WIZARD_INDEX_TO_MACRO: MacroStepKey[] = [
  "expediente", // 1 Tipo de contrato
  "expediente", // 2 Arrendador
  "expediente", // 3 Arrendatario
  "expediente", // 4 Codeudor
  "expediente", // 5 Inmueble
  "condiciones", // 6 Términos
  "condiciones", // 7 Servicios
  "condiciones", // 8 Cláusulas especiales
  "revision", // 9 Resumen
  "revision", // 10 Vista previa
];

/** Macro-paso al que pertenece un índice del asistente (1-based). */
export function macroForWizardIndex(n: number): MacroStepKey {
  if (!Number.isFinite(n) || n < 1) return "expediente";
  return WIZARD_INDEX_TO_MACRO[Math.min(n, WIZARD_INDEX_TO_MACRO.length) - 1];
}

export type MacroState = "done" | "current" | "available" | "locked";

/** Resumen mínimo para derivar el estado de los macro-pasos. */
export type Steps5Latest = {
  currentVersionId?: string | null;
  contractStatus?: string | null;
};

/**
 * Estado de cada macro-paso (sin marcar el actual; eso lo pone el stepper).
 * - Pasos 1–3: siempre navegables (construir/revisar). "done" si ya hay versión.
 * - Firma / Acta / Posventa: bloqueados hasta guardar una versión del contrato.
 */
export function deriveMacroStates(
  latest: Steps5Latest | null,
): Record<MacroStepKey | "posventa", MacroState> {
  const saved = Boolean(latest?.currentVersionId);
  const signed = (latest?.contractStatus ?? "") === "signed";
  return {
    expediente: saved ? "done" : "available",
    condiciones: saved ? "done" : "available",
    revision: "available",
    firma: signed ? "done" : saved ? "available" : "locked",
    acta: saved ? "available" : "locked",
    posventa: saved ? "available" : "locked",
  };
}
