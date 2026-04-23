/**
 * Reglas de referencia basadas en la Ley 820 de 2003 (vivienda urbana) para:
 * tope de canon, valor comercial vs avalúo, y tope de reajuste anual vinculado al IPC.
 * Los montos y porcentajes deben ser revisados por asesoría legal; esta capa
 * aplica reglas de negocio reutilizables y bloquea incoherencias obvias en la UI.
 */
export const URBAN_HOUSING_MONTHLY_RENT_MAX_RATIO = 0.01; // 1% valor comercial / mes
export const MAX_COMMERCIAL_TO_CADASTRE_RATIO = 2; // tope típico comercial <= 2x avalúo (Ley 820)

export type EffectiveCommercialValueInput = {
  commercialValue: number;
  /** Avalúo catastral en COP; si se omite, se usa commercialValue */
  cadastralValue?: number;
};

/**
 * Ajusta el valor comercial de trabajo según tope 2x avalúo cuando hay avalúo.
 */
export function getEffectiveCommercialValue(
  input: EffectiveCommercialValueInput
): { effective: number; cappedByCadastre: boolean } {
  if (!Number.isFinite(input.commercialValue) || input.commercialValue <= 0) {
    return { effective: 0, cappedByCadastre: false };
  }
  const c = input.commercialValue;
  const cad = input.cadastralValue;
  if (cad == null || !Number.isFinite(cad) || cad <= 0) {
    return { effective: c, cappedByCadastre: false };
  }
  const maxCommercial = MAX_COMMERCIAL_TO_CADASTRE_RATIO * cad;
  if (c > maxCommercial) {
    return { effective: maxCommercial, cappedByCadastre: true };
  }
  return { effective: c, cappedByCadastre: false };
}

export function calculateLegalMonthlyRentCap(
  input: EffectiveCommercialValueInput
): { cap: number; effectiveCommercial: number; cappedByCadastre: boolean } {
  const { effective, cappedByCadastre } = getEffectiveCommercialValue(input);
  const cap = Math.max(0, effective * URBAN_HOUSING_MONTHLY_RENT_MAX_RATIO);
  return { cap, effectiveCommercial: effective, cappedByCadastre };
}

export function validateProposedRent(
  proposedMonthlyRent: number,
  input: EffectiveCommercialValueInput
): { ok: boolean; cap: number; reason?: string } {
  const { cap } = calculateLegalMonthlyRentCap(input);
  if (proposedMonthlyRent > cap) {
    return {
      ok: false,
      cap,
      reason:
        "El canon supera el tope del 1% del valor comercial aplicable a vivienda urbana (Ley 820). Ajusta el valor o el canon.",
    };
  }
  return { ok: true, cap };
}

/**
 * Reajuste anual: incremento no mayor al 100% del IPC del año calendario anterior
 * (regla típica citada; el % IPC anual se pasa explícitamente, ej. 12.3).
 * newRentMax = currentRent * (1 + min(requestedIpcPercent, annualIpcPercent) / 100)
 */
export function calculateMaxAllowedRentAfterIpc(
  currentMonthlyRent: number,
  annualIpcPreviousYearPercent: number
): { maxNewRent: number } {
  if (!Number.isFinite(currentMonthlyRent) || currentMonthlyRent <= 0) {
    return { maxNewRent: 0 };
  }
  const p = Math.max(0, annualIpcPreviousYearPercent);
  return { maxNewRent: currentMonthlyRent * (1 + p / 100) };
}

export function formatCop(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}
