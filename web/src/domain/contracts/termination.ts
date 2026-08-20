/**
 * Terminación / no renovación del arriendo (vivienda urbana, Ley 820 de 2003).
 * ArriendoSeguro NO es abogado: esto orienta y deja constancia; la validez y los
 * montos dependen del caso concreto y de la asesoría legal de las partes.
 */

export type TerminationType = "non_renewal" | "early";
export type LeasePhase = "initial" | "renewal";
export type TerminationStatus = "notified" | "accepted" | "rejected";

/** Preaviso legal para vivienda urbana (meses). */
export const NOTICE_MONTHS = 3;

/**
 * Meses de canon de INDEMNIZACIÓN por terminación ANTICIPADA (unilateral), según
 * quién termina y la etapa del contrato:
 *  - Arrendatario, vigencia inicial (art. 24 §1): 3 meses.
 *  - Arrendatario, durante prórrogas (art. 24 §2): 1,5 meses.
 *  - Arrendador (causales especiales, art. 22): 3 meses.
 * La NO renovación (a la fecha de vencimiento, con preaviso) NO genera esta
 * indemnización.
 */
export function earlyTerminationPenaltyMonths(byRole: string, phase: LeasePhase): number {
  if (byRole === "landlord") return 3;
  return phase === "renewal" ? 1.5 : 3;
}

/** Texto legal (informativo) para mostrar antes de aceptar. */
export function terminationLegalText(input: { type: TerminationType; byRole: string; phase: LeasePhase; monthlyRent: number; penaltyMonths: number }): string[] {
  const monto = Math.round(input.monthlyRent * input.penaltyMonths);
  const money = `$${monto.toLocaleString("es-CO")}`;
  if (input.type === "non_renewal") {
    return [
      `Estás por registrar un AVISO DE NO RENOVACIÓN del contrato de arriendo.`,
      `Para que sea válido, el preaviso debe darse con al menos ${NOTICE_MONTHS} meses de antelación al vencimiento (Ley 820 de 2003, arts. 5, 6 y 22).`,
      `Dado en término y forma, la no renovación NO genera indemnización.`,
      `Se dejará constancia con fecha y se notificará a la otra parte.`,
    ];
  }
  const base = input.byRole === "landlord"
    ? `Como ARRENDADOR NO puedes terminar unilateralmente a mitad de vigencia por tu sola voluntad: la Ley 820 protege la estabilidad del arrendatario. Solo procede por (a) incumplimiento del arrendatario (causa justa, sin indemnización, con el debido proceso), (b) mutuo acuerdo, o (c) causales especiales a la fecha de vencimiento (necesitar el inmueble, demolición, etc.), que exigen preaviso de ${NOTICE_MONTHS} meses e indemnización a favor del ARRENDATARIO equivalente a ${input.penaltyMonths} meses de canon. Este registro deja constancia del aviso; consulta a tu abogado sobre la causal y el monto.`
    : input.phase === "renewal"
      ? `Como ARRENDATARIO, durante las prórrogas puedes terminar unilateralmente con preaviso de ${NOTICE_MONTHS} meses e indemnización equivalente a ${input.penaltyMonths} meses de canon (art. 24 §2, Ley 820 de 2003).`
      : `Como ARRENDATARIO, en la vigencia inicial puedes terminar unilateralmente con preaviso de ${NOTICE_MONTHS} meses e indemnización equivalente a ${input.penaltyMonths} meses de canon (art. 24 §1, Ley 820 de 2003).`;
  return [
    `Estás por registrar una TERMINACIÓN ANTICIPADA (antes del vencimiento).`,
    base,
    `Indemnización estimada: ${input.penaltyMonths} × canon (${input.monthlyRent.toLocaleString("es-CO")}) = ${money}.`,
    `Debes dar el preaviso de ${NOTICE_MONTHS} meses. Al aceptar, reconoces la penalización y se deja constancia; luego se notifica a la otra parte para su aceptación.`,
  ];
}

export function terminationTypeLabel(type: TerminationType): string {
  return type === "non_renewal" ? "Aviso de no renovación" : "Terminación anticipada";
}

/**
 * Textos EXACTOS que cada parte acepta al registrar/responder una terminación.
 * Se usan tanto en la UI como al guardar la evidencia, para que en el expediente
 * quede constancia literal de QUÉ aceptó cada quien (no solo un booleano) y que
 * sabían que ArriendoSeguro es solo la plataforma de intermediación.
 */
export const TERMINATION_ACK = {
  /** Quien inicia la terminación anticipada: reconoce la indemnización. */
  notifierPenalty: (amount: number, months: number): string =>
    `Reconozco que la terminación anticipada genera una indemnización de $${amount.toLocaleString("es-CO")} (${months} meses de canon).`,
  /** Quien inicia: entiende el preaviso y que ArriendoSeguro solo deja constancia. */
  notifierNotice: `Entiendo que debo dar el preaviso de ${NOTICE_MONTHS} meses y que ArriendoSeguro solo deja constancia; no sustituye asesoría legal.`,
  /** Quien acepta (parte que recibe): descargo de intermediación + pago por fuera. */
  intermediation:
    "Entiendo y acepto que ArriendoSeguro es únicamente la plataforma de intermediación tecnológica: envía esta comunicación y deja la constancia con fecha y evidencia, pero NO recauda, administra, retiene ni garantiza el pago de la indemnización ni de ninguna suma entre las partes. La transacción la realizamos directamente las partes, por fuera de la plataforma y bajo nuestro propio riesgo. Podré, si quiero, dejar la trazabilidad del pago en la plataforma.",
} as const;
