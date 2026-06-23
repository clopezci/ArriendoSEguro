/**
 * Guía simple por paso para el onboarding "de una sola línea". Para cada paso del
 * asistente (1..N) y para la posventa, un texto de «qué haces aquí» y «qué sigue».
 * Datos puros (sin React) para poder testearlos y para no acoplar al WizardShell.
 */

export type StepGuideEntry = {
  /** Macro-fase a la que pertenece el paso. */
  group: string;
  /** Título corto del paso. */
  title: string;
  /** Una frase de qué se hace aquí. */
  hint: string;
  /** Qué sigue después (la "flecha"). */
  next: string;
};

/** Orden del asistente (debe coincidir con WIZARD_STEPS). */
const STEP_GUIDES: StepGuideEntry[] = [
  { group: "Tus datos y el inmueble", title: "Tipo de contrato", hint: "Hoy generamos arriendo de vivienda urbana.", next: "Tus datos como dueño" },
  { group: "Tus datos y el inmueble", title: "Arrendador (dueño)", hint: "Tus datos. Puedes usar los que ya guardaste.", next: "Datos del inquilino" },
  { group: "Tus datos y el inmueble", title: "Arrendatario (inquilino)", hint: "Ingrésalos tú o envíale un enlace para que él los llene.", next: "Codeudor (opcional)" },
  { group: "Tus datos y el inmueble", title: "Codeudor (opcional)", hint: "¿Hay codeudor? También aquí va la validación crediticia (opcional).", next: "Datos del inmueble" },
  { group: "Tus datos y el inmueble", title: "Inmueble a arrendar", hint: "Datos del inmueble. Puedes elegir uno guardado.", next: "Términos del arriendo" },
  { group: "Condiciones del contrato", title: "Términos", hint: "Canon, fechas, día de pago y duración.", next: "Servicios y garantía" },
  { group: "Condiciones del contrato", title: "Servicios públicos", hint: "Servicios y la garantía del Art. 15 (opcional).", next: "Cláusulas especiales" },
  { group: "Condiciones del contrato", title: "Cláusulas especiales", hint: "Mascotas, parqueadero, etc. Opcional.", next: "Revisar el contrato" },
  { group: "Revisa, firma y PDF", title: "Resumen", hint: "Revisa todo antes de la vista previa.", next: "Vista previa" },
  { group: "Revisa, firma y PDF", title: "Vista previa", hint: "Guarda, firma (Plan Plus) y descarga el PDF.", next: "Posventa: pagos, alertas, documentos e inventario" },
];

export const WIZARD_STEP_COUNT = STEP_GUIDES.length;

/** Guía del paso `n` (1-based). Si está fuera de rango, devuelve null. */
export function stepGuide(n: number): (StepGuideEntry & { index: number; total: number }) | null {
  if (!Number.isFinite(n) || n < 1 || n > STEP_GUIDES.length) return null;
  return { ...STEP_GUIDES[n - 1], index: n, total: STEP_GUIDES.length };
}

/** Guía para las páginas de posventa (variant "extra"). */
export const POSTSALE_GUIDE: StepGuideEntry = {
  group: "Después de firmar",
  title: "Posventa del contrato",
  hint: "Configura pagos y alertas, sube documentos y haz el inventario, paso a paso.",
  next: "Volver al centro de posventa para ver qué falta",
};
