/**
 * Terminación / no renovación del arriendo (vivienda urbana). TODO se rige por la
 * Ley 820 de 2003 y las normas que la modifiquen, adicionen o sustituyan. La app
 * NO fija ni cobra montos: DEJA CONSTANCIA (Ley 527 de 1999), NOTIFICA y ORIENTA
 * de forma ILUSTRATIVA (no vinculante). Los meses que se muestran son solo
 * orientación; el monto y el procedimiento exactos dependen del caso y de la
 * asesoría legal de las partes.
 */

export type TerminationType = "non_renewal" | "early";
export type LeasePhase = "initial" | "renewal";
export type TerminationStatus = "notified" | "accepted" | "rejected";

/** Preaviso vigente en la Ley 820 (meses). Referencial. */
export const NOTICE_MONTHS = 3;

/**
 * ORIENTACIÓN ILUSTRATIVA (no vinculante) de la indemnización en meses de canon
 * por terminación anticipada SIN causa, según la Ley 820 de 2003:
 *  - Arrendatario (art. 24 §4), en vigencia inicial O durante prórrogas: 3 meses.
 *  - Arrendador durante prórrogas (art. 22 §7): 3 meses.
 * La plena voluntad del arrendador al vencimiento con 4+ años (art. 22 §8 d) es
 * 1,5 meses, pero requiere invocar esa causal: se explica en el texto, no aquí.
 * Si la terminación es por INCUMPLIMIENTO de la otra parte (arts. 24 §1-3 / 22
 * §1-6), la ley NO contempla indemnización; eso se aclara en el texto legal.
 */
export function earlyTerminationPenaltyMonths(_byRole: string, _phase: LeasePhase): number {
  return 3;
}

/** Texto legal (informativo, NO vinculante) para mostrar antes de registrar/aceptar. */
export function terminationLegalText(input: { type: TerminationType; byRole: string; phase: LeasePhase; monthlyRent: number; penaltyMonths: number }): string[] {
  if (input.type === "non_renewal") {
    const roleLine = input.byRole === "landlord"
      ? "Como ARRENDADOR, para terminar a la fecha de vencimiento debes invocar una de las causales especiales del art. 22 §8 de la Ley 820 (necesitar el inmueble para tu habitación por 1+ año, demolición u obras, compraventa, o plena voluntad si el contrato ya cumplió 4 años). Las causales de ocupar/demoler/vender exigen constituir una caución a favor del arrendatario; la de plena voluntad contempla una indemnización orientativa de ~1,5 meses de canon."
      : "Como ARRENDATARIO, puedes NO renovar dando aviso con no menos de 3 meses de antelación, sin invocar causal y sin indemnización (art. 24 §5 de la Ley 820).";
    return [
      "Vas a registrar un AVISO relacionado con el VENCIMIENTO del contrato (no continuar / no renovar).",
      roleLine,
      "El aviso debe ser POR ESCRITO y por un medio TRAZABLE que permita acreditar que la otra parte lo recibió. A falta de constancia del preaviso, la ley entiende el contrato RENOVADO automáticamente.",
      "ArriendoSeguro deja la constancia con fecha y evidencia (Ley 527 de 1999) y notifica a la otra parte; su confirmación en la plataforma sirve como prueba de recibido. No sustituye asesoría legal.",
    ];
  }
  const base = input.byRole === "landlord"
    ? "Como ARRENDADOR NO puedes terminar a mitad de vigencia por tu sola voluntad: la Ley 820 protege la estabilidad del arrendatario. Procede por (a) INCUMPLIMIENTO del arrendatario (sin indemnización, con el debido proceso), (b) mutuo acuerdo, (c) DURANTE LAS PRÓRROGAS con preaviso e indemnización (art. 22 §7), o (d) al VENCIMIENTO por una causal especial del art. 22 §8 (la plena voluntad exige 4+ años; ocupar/demoler/vender exigen caución a favor del arrendatario)."
    : "Como ARRENDATARIO puedes terminar unilateralmente en la vigencia inicial o durante las prórrogas con preaviso e indemnización (art. 24 §4 de la Ley 820), salvo que termines por INCUMPLIMIENTO del arrendador (art. 24 §1-3), caso en el que la ley no contempla indemnización a tu cargo.";
  return [
    "Vas a registrar una TERMINACIÓN ANTICIPADA (antes del vencimiento).",
    base,
    "Orientación ILUSTRATIVA (no vinculante): si es SIN causa, la Ley 820 contempla un preaviso de ~3 meses y una indemnización orientativa de ~3 meses de canon. Si es por INCUMPLIMIENTO de la otra parte, la ley no contempla indemnización a tu cargo, pero debes poder DEMOSTRAR el incumplimiento y la notificación. El monto y el trámite exactos los define la ley y tu abogado.",
    "El aviso debe ser POR ESCRITO y TRAZABLE, con prueba de recibido (p. ej. la confirmación de la otra parte en la plataforma, WhatsApp con confirmación de lectura, correo con acuse, o servicio postal autorizado). ArriendoSeguro deja la constancia y notifica; NO recauda ni administra indemnizaciones.",
  ];
}

export function terminationTypeLabel(type: TerminationType): string {
  return type === "non_renewal" ? "Aviso de no renovación" : "Terminación anticipada";
}

/**
 * Textos EXACTOS que cada parte acepta al registrar/responder una terminación.
 * Se usan tanto en la UI como al guardar la evidencia, para que en el expediente
 * quede constancia literal de QUÉ aceptó cada quien (no solo un booleano). Son
 * declaraciones NO vinculantes que remiten a la Ley 820 (los montos y el trámite
 * los define la ley y la asesoría legal), y dejan claro que ArriendoSeguro solo
 * es la plataforma de intermediación y constancia (Ley 527 de 1999).
 */
export const TERMINATION_ACK = {
  /**
   * Quien inicia el aviso: reconoce que TODO se rige por la Ley 820 y que la
   * orientación de la plataforma es ilustrativa (no vinculante). Los parámetros
   * se conservan por compatibilidad; el texto ya NO afirma un monto vinculante.
   */
  notifierPenalty: (_amount: number, _months: number): string =>
    "Reconozco que la terminación o no renovación y sus efectos (preaviso, indemnización si aplica y procedimiento) se rigen por la Ley 820 de 2003 y las normas que la modifiquen; que la orientación de la plataforma es ILUSTRATIVA y NO vinculante; y que el monto y el trámite exactos dependen del caso y de mi asesoría legal.",
  /** Quien inicia: aviso escrito y trazable con prueba de recibido; ArriendoSeguro solo deja constancia (Ley 527). */
  notifierNotice:
    "Entiendo que el aviso debe darse POR ESCRITO y por un medio TRAZABLE con prueba de recibido, y que ArriendoSeguro deja la constancia (Ley 527 de 1999) y notifica; no recauda ni administra indemnizaciones ni sustituye asesoría legal.",
  /** Quien acepta (parte que recibe): descargo de intermediación + pago por fuera. */
  intermediation:
    "Entiendo y acepto que ArriendoSeguro es únicamente la plataforma de intermediación tecnológica: envía esta comunicación y deja la constancia con fecha y evidencia, pero NO recauda, administra, retiene ni garantiza el pago de la indemnización ni de ninguna suma entre las partes. La transacción la realizamos directamente las partes, por fuera de la plataforma y bajo nuestro propio riesgo. Podré, si quiero, dejar la trazabilidad del pago en la plataforma.",
} as const;
