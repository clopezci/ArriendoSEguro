/**
 * Garantía para el pago de **servicios públicos** (Artículo 15 de la Ley 820 de
 * 2003). A diferencia del depósito general (prohibido por el art. 16), esta
 * garantía SÍ es legal, pero es **exclusiva para servicios públicos** y su valor
 * **no puede exceder** el de los dos (2) últimos períodos de facturación.
 *
 * Aquí el máximo se calcula como la suma de las dos últimas facturas que informe
 * el arrendador; el valor pactado como garantía no puede superar ese máximo.
 */

export type UtilityServicesGuarantee = {
  enabled: boolean;
  /** Valor de la factura del último período (COP). */
  lastPeriod1Cop: number;
  /** Valor de la factura del penúltimo período (COP). */
  lastPeriod2Cop: number;
  /** Máximo permitido = suma de los dos períodos (calculado). */
  maxAllowedCop: number;
  /** Valor pactado como garantía (≤ máximo). */
  agreedAmountCop: number;
  /** Constancia de aceptación con captura de IP (se completa en el servidor). */
  acceptedAt?: string;
};

/** Máximo legal de la garantía = suma de los dos períodos. */
export function computeMaxUtilityGuaranteeCop(lastPeriod1Cop: number, lastPeriod2Cop: number): number {
  const a = Number.isFinite(lastPeriod1Cop) && lastPeriod1Cop > 0 ? Math.floor(lastPeriod1Cop) : 0;
  const b = Number.isFinite(lastPeriod2Cop) && lastPeriod2Cop > 0 ? Math.floor(lastPeriod2Cop) : 0;
  return a + b;
}

export type UtilityGuaranteeInput = {
  lastPeriod1Cop: number;
  lastPeriod2Cop: number;
  agreedAmountCop: number;
};

/**
 * Valida la garantía: ambos períodos positivos, valor pactado positivo y que
 * no supere el máximo (suma de los dos períodos). Devuelve el máximo calculado.
 */
export function validateUtilityGuarantee(
  input: UtilityGuaranteeInput,
): { ok: true; maxAllowedCop: number } | { ok: false; error: string; maxAllowedCop: number } {
  const p1 = Math.floor(Number(input.lastPeriod1Cop));
  const p2 = Math.floor(Number(input.lastPeriod2Cop));
  const agreed = Math.floor(Number(input.agreedAmountCop));
  const maxAllowedCop = computeMaxUtilityGuaranteeCop(p1, p2);

  if (!Number.isInteger(p1) || p1 <= 0 || !Number.isInteger(p2) || p2 <= 0) {
    return { ok: false, error: "Ingresa el valor de las dos últimas facturas de servicios públicos.", maxAllowedCop };
  }
  if (!Number.isInteger(agreed) || agreed <= 0) {
    return { ok: false, error: "Ingresa el valor que pactarán como garantía.", maxAllowedCop };
  }
  if (agreed > maxAllowedCop) {
    return {
      ok: false,
      error: `La garantía (${agreed.toLocaleString("es-CO")}) no puede superar el máximo legal de ${maxAllowedCop.toLocaleString("es-CO")} (suma de los dos últimos períodos, Art. 15 Ley 820 de 2003).`,
      maxAllowedCop,
    };
  }
  return { ok: true, maxAllowedCop };
}
