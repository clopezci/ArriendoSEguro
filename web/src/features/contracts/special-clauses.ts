/**
 * Catálogo de cláusulas especiales que las partes pueden incluir en el
 * contrato (Bloque 5 del plan de mejoras).
 *
 * Decisiones de diseño:
 * - Cada cláusula tiene un `id` corto en mayúsculas para persistencia y
 *   uso en el contrato (placeholder de `AS-LEASE-2026.2`).
 * - `label` y `description` son textos finales para el usuario en
 *   español natural colombiano (mobile-first: cortos y claros).
 * - `OTRA` es el id reservado para la opción de texto libre. Cuando
 *   está seleccionado, el wizard exige llenar `freeText` con la
 *   redacción puntual que solicita la persona.
 * - El listado se mantiene corto a propósito: las cláusulas raras
 *   o muy específicas entran por "Otra" y se cobran como servicio
 *   adicional (aviso de costo).
 */

export const SPECIAL_CLAUSE_OTHER_ID = "OTRA" as const;

export interface SpecialClauseOption {
  id: string;
  label: string;
  description: string;
}

export const SPECIAL_CLAUSE_OPTIONS: SpecialClauseOption[] = [
  {
    id: "MASCOTAS",
    label: "Mascotas en el inmueble",
    description:
      "Se aclaran reglas y cuidados (tipo de mascota, aseo, daños, ruido, certificados sanitarios).",
  },
  {
    id: "FUMADORES",
    label: "Prohibición o permiso para fumar",
    description:
      "Se define si está prohibido fumar dentro del inmueble, áreas comunes o balcones.",
  },
  {
    id: "PARQUEADERO",
    label: "Uso de parqueadero o garaje",
    description:
      "Asigna cupo, condiciones, costo si está aparte y responsabilidad por daños.",
  },
  {
    id: "TELETRABAJO",
    label: "Uso para teletrabajo o trabajo profesional",
    description:
      "Permite uso parcial del inmueble para teletrabajo sin convertirlo en local comercial.",
  },
  {
    id: "MOBILIARIO",
    label: "Inmueble entregado amoblado",
    description:
      "Se especifica que el inmueble se entrega con mobiliario, electrodomésticos o enseres, según inventario adjunto.",
  },
  {
    id: "ZONAS_VERDES",
    label: "Mantenimiento de zonas verdes o patios",
    description:
      "Define responsabilidad del cuidado de jardín, patio, terraza o áreas exteriores.",
  },
  {
    id: "SEGURIDAD",
    label: "Alarmas, cámaras o sistemas de seguridad",
    description:
      "Reglas sobre cambio de cerraduras, mantenimiento o pago de monitoreo y alarmas.",
  },
  {
    id: SPECIAL_CLAUSE_OTHER_ID,
    label: "Otra cláusula especial",
    description:
      "Escríbela en tus palabras. Tiene un cobro adicional porque la revisa nuestro equipo jurídico (especialmente cláusulas de pago, multas o penalidades). Te mostramos el valor al elegirla.",
  },
];

/**
 * Devuelve la etiqueta amigable de una cláusula a partir de su id.
 * Si el id es desconocido se muestra tal cual (útil para drafts
 * antiguos o ids agregados a futuro).
 */
export function getSpecialClauseLabel(id: string): string {
  const found = SPECIAL_CLAUSE_OPTIONS.find((opt) => opt.id === id);
  return found ? found.label : id;
}

/**
 * Aviso fijo de costo adicional. Solo se muestra cuando el usuario marca
 * «Otra» y escribe una cláusula libre: la lista predefinida del catálogo
 * (mascotas, fumadores, parqueadero, teletrabajo, mobiliario, zonas
 * verdes, seguridad) se incluye automáticamente en el contrato sin costo,
 * porque su redacción ya está curada por el equipo legal.
 */
export const SPECIAL_CLAUSES_COST_NOTICE =
  "La opción «Otra» implica redacción personalizada por parte del equipo " +
  "de ArriendoSeguro y revisión para que se ajuste a la normatividad " +
  "colombiana. En particular, las cláusulas relacionadas con pagos, multas, " +
  "intereses o penalidades deben ser revisadas por un abogado. Por eso " +
  "tiene un costo adicional, el cual te será notificado antes de generar el " +
  "contrato definitivo.";

/**
 * Aviso informativo (sin costo) que se muestra cuando hay cláusulas
 * predefinidas seleccionadas. Aclara al usuario que esas se incluyen
 * sin cargo y con redacción legal validada.
 */
export const SPECIAL_CLAUSES_FREE_NOTICE =
  "Las cláusulas del catálogo se incluyen automáticamente en el contrato " +
  "sin costo adicional: su redacción legal ya está revisada para que se " +
  "ajuste a la ley colombiana (Ley 820 de 2003 y normas concordantes).";

/** Longitud máxima del texto libre cuando se elige «Otra». */
export const SPECIAL_CLAUSE_FREE_TEXT_MAX_LENGTH = 1500;
