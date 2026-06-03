/**
 * Recordatorios de terminación/renovación del contrato.
 *
 * Regla (definida con el negocio): avisar con suficiente antelación al preaviso
 * legal de 3 meses (Ley 820 de 2003, vivienda urbana). Se envían DOS
 * recordatorios semanales:
 *   - r1: 3 meses + 2 semanas antes del fin.
 *   - r2: 3 meses + 1 semana antes del fin (una semana después de r1).
 * Nunca después del "deadline" = 3 meses antes del fin (el preaviso legal).
 */

export type RenewalReminderKey = "r1" | "r2";

function parseDateUtc(endDateIso: string): Date | null {
  const s = endDateIso.length === 10 ? `${endDateIso}T00:00:00.000Z` : endDateIso;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function renewalReminderTargets(
  endDateIso: string,
): { target1: Date; target2: Date; deadline: Date } | null {
  const end = parseDateUtc(endDateIso);
  if (!end) return null;
  const deadline = new Date(end);
  deadline.setUTCMonth(deadline.getUTCMonth() - 3); // preaviso legal de 3 meses
  const target1 = new Date(deadline);
  target1.setUTCDate(target1.getUTCDate() - 14); // 3 meses + 2 semanas
  const target2 = new Date(deadline);
  target2.setUTCDate(target2.getUTCDate() - 7); // 3 meses + 1 semana
  return { target1, target2, deadline };
}

/**
 * Decide qué recordatorio corresponde enviar HOY, dado lo ya enviado. Devuelve
 * uno por ejecución (prioriza r1 si falta). `null` si no hay nada pendiente.
 */
export function dueRenewalReminder(
  endDateIso: string,
  now: Date,
  sent: { r1?: boolean; r2?: boolean },
): RenewalReminderKey | null {
  const t = renewalReminderTargets(endDateIso);
  if (!t) return null;
  if (now > t.deadline) return null; // ya pasó el preaviso legal
  if (!sent.r1 && now >= t.target1) return "r1";
  if (!sent.r2 && now >= t.target2) return "r2";
  return null;
}

/** Días enteros (UTC) entre ahora y el fin del contrato (>= 0). */
export function daysUntilEnd(endDateIso: string, now: Date): number {
  const end = parseDateUtc(endDateIso);
  if (!end) return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}
