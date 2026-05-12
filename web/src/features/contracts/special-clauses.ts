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
      "Escribe en tus palabras la cláusula adicional que necesitas que quede registrada.",
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

/** Texto fijo del aviso de costo adicional que ven las partes. */
export const SPECIAL_CLAUSES_COST_NOTICE =
  "Tener en cuenta que estas cláusulas pueden tener un costo adicional, " +
  "el cual te será notificado antes de generar el contrato definitivo. " +
  "El equipo de ArriendoSeguro las revisará para confirmar que se ajusten a la ley colombiana.";

/** Longitud máxima del texto libre cuando se elige «Otra». */
export const SPECIAL_CLAUSE_FREE_TEXT_MAX_LENGTH = 1500;
