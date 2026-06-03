/**
 * Calificación de reputación bidireccional, **solo por estrellas (1–5)**, sin
 * texto libre. Las variables dependen de la dirección de la calificación:
 * el arrendador (dueño) califica al arrendatario (inquilino) y viceversa.
 *
 * Compartido cliente/servidor (sin imports de Node). Alineado con
 * `/legal/evaluacion`: estructurada, privada, sin lista negra.
 */

export type ReputationDirection = "landlord_to_tenant" | "tenant_to_landlord";

export type ReputationCriterion = {
  key: string;
  label: string;
  help: string;
};

export const REPUTATION_DIRECTIONS: ReputationDirection[] = [
  "landlord_to_tenant",
  "tenant_to_landlord",
];

export const REPUTATION_DIRECTION_LABELS: Record<ReputationDirection, string> = {
  landlord_to_tenant: "Arrendador (dueño) califica al arrendatario (inquilino)",
  tenant_to_landlord: "Arrendatario (inquilino) califica al arrendador (dueño)",
};

/** Variables (criterios) por dirección. Cada una se valora de 1 a 5 estrellas. */
export const REPUTATION_CRITERIA: Record<ReputationDirection, ReputationCriterion[]> = {
  landlord_to_tenant: [
    { key: "payment", label: "Cumplimiento de pago", help: "¿Pagó el canon y las obligaciones a tiempo?" },
    { key: "property_care", label: "Cuidado del inmueble", help: "¿Mantuvo el inmueble en buen estado?" },
    { key: "communication", label: "Comunicación", help: "¿Fue claro y receptivo al comunicarse?" },
    { key: "respect", label: "Respeto y convivencia", help: "¿Cumplió normas de convivencia y dio buen trato?" },
    { key: "handover", label: "Entrega final del inmueble", help: "¿Entregó el inmueble conforme a lo acordado?" },
  ],
  tenant_to_landlord: [
    { key: "maintenance", label: "Cumplimiento en mantenimiento", help: "¿Atendió las solicitudes y reparaciones?" },
    { key: "response_time", label: "Tiempos de respuesta", help: "¿Respondió en tiempos razonables?" },
    { key: "communication", label: "Comunicación", help: "¿Fue claro y receptivo al comunicarse?" },
    { key: "respect", label: "Respeto y trato", help: "¿Dio un trato respetuoso y profesional?" },
    { key: "transparency", label: "Transparencia y cumplimiento", help: "¿Cumplió lo pactado y fue transparente?" },
  ],
};

/** Dirección que le corresponde a quien califica según su rol en el contrato. */
export function directionForRaterRole(role: "landlord" | "tenant" | "solidaryCoDebtor"): ReputationDirection | null {
  if (role === "landlord") return "landlord_to_tenant";
  if (role === "tenant") return "tenant_to_landlord";
  return null; // el codeudor no califica en esta fase
}

export function criteriaKeys(direction: ReputationDirection): string[] {
  return REPUTATION_CRITERIA[direction].map((c) => c.key);
}

/**
 * Valida un mapa de calificaciones: deben estar exactamente las claves del
 * criterio de la dirección, cada una entera entre 1 y 5.
 */
export function validateRatings(
  direction: ReputationDirection,
  ratings: Record<string, unknown>,
): { ok: true; values: Record<string, number>; overall: number } | { ok: false; error: string } {
  const keys = criteriaKeys(direction);
  const values: Record<string, number> = {};
  for (const k of keys) {
    const v = ratings[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
      return { ok: false, error: `Califica "${k}" con un valor entre 1 y 5 estrellas.` };
    }
    values[k] = v;
  }
  const extra = Object.keys(ratings).filter((k) => !keys.includes(k));
  if (extra.length > 0) return { ok: false, error: "Hay criterios no válidos para esta dirección." };
  const overall = Math.round((keys.reduce((s, k) => s + values[k], 0) / keys.length) * 100) / 100;
  return { ok: true, values, overall };
}
