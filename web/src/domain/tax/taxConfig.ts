/**
 * Configuración tributaria de la plataforma (Colombia). Módulo **puro** (sin
 * Firebase ni red), reusable en cliente y servidor y cubierto por tests.
 *
 * Regla de negocio (ver docs/IMPUESTOS-COLOMBIA.md):
 * - Se cobra IVA (19%) SOLO si la empresa es **responsable de IVA**.
 * - Arranca en `ivaResponsable: false` (no responsable → precio final, sin IVA).
 * - Al superar el tope de ley (3.500 UVT de ingresos en el año), el sistema puede
 *   ACTIVAR solo el toggle y alertar al creador (ver el cron de impuestos).
 * - La tarifa (19%) casi no cambia (solo por reforma); la UVT cambia cada año.
 */

export const TAX_CONFIG_COLLECTION = "app_settings";
export const TAX_CONFIG_DOC_ID = "tax_config";

/** Umbral legal para volverse responsable de IVA (Art. 437 E.T.): 3.500 UVT. */
export const IVA_RESPONSABLE_UVT_THRESHOLD = 3500;

export type TaxRegime = "no_responsable" | "responsable" | "simple";

export interface TaxConfig {
  /** ¿La empresa es responsable de IVA? (si false, no se cobra IVA). */
  ivaResponsable: boolean;
  /** Tarifa de IVA en % (general 19). */
  ivaRate: number;
  /** Valor de la UVT vigente (COP). Cambia cada año (lo publica la DIAN). */
  uvtValue: number;
  /** Año de la UVT vigente. */
  uvtYear: number;
  /** Régimen tributario declarado (informativo). */
  regime: TaxRegime;
  /** Si el toggle se activó AUTOMÁTICAMENTE por superar el tope (ISO). */
  autoActivatedAt?: string;
  /** Última vez que se avisó "te acercas al tope" (para no repetir el aviso). */
  thresholdWarnedAt?: string;
  updatedAt?: string;
  updatedByEmail?: string;
}

export function defaultTaxConfig(): TaxConfig {
  return {
    ivaResponsable: false, // hoy: NO responsable → precio final sin IVA
    ivaRate: 19,
    uvtValue: 52374, // UVT 2026 (actualízalo cada año)
    uvtYear: 2026,
    regime: "no_responsable",
  };
}

/** Resuelve la config de forma tolerante por campo (valor inválido → default). */
export function resolveTaxConfig(stored: unknown): TaxConfig {
  const base = defaultTaxConfig();
  const o = (typeof stored === "object" && stored !== null ? stored : {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, fb: number): number => {
    const n = typeof v === "number" ? v : NaN;
    return Number.isFinite(n) && n >= min && n <= max ? n : fb;
  };
  const regime: TaxRegime =
    o.regime === "responsable" || o.regime === "simple" || o.regime === "no_responsable"
      ? o.regime
      : base.regime;

  const config: TaxConfig = {
    ivaResponsable: typeof o.ivaResponsable === "boolean" ? o.ivaResponsable : base.ivaResponsable,
    ivaRate: num(o.ivaRate, 0, 100, base.ivaRate),
    uvtValue: num(o.uvtValue, 1000, 1_000_000, base.uvtValue),
    uvtYear: num(o.uvtYear, 2020, 2100, base.uvtYear),
    regime,
  };
  if (typeof o.autoActivatedAt === "string") config.autoActivatedAt = o.autoActivatedAt;
  if (typeof o.thresholdWarnedAt === "string") config.thresholdWarnedAt = o.thresholdWarnedAt;
  if (typeof o.updatedAt === "string") config.updatedAt = o.updatedAt;
  if (typeof o.updatedByEmail === "string") config.updatedByEmail = o.updatedByEmail;
  return config;
}

export type TaxedPrice = {
  /** Precio base (sin IVA). */
  baseCop: number;
  /** IVA calculado (0 si no responsable). */
  ivaCop: number;
  /** Total a pagar (base + IVA). */
  totalCop: number;
  /** ¿Se aplicó IVA? */
  ivaApplies: boolean;
  /** Tarifa aplicada (%). */
  ivaRate: number;
};

/**
 * Calcula el precio con IVA a partir de un **precio base** (sin IVA). El IVA se
 * AGREGA (no viene incluido): si es responsable, total = base × (1 + tarifa/100).
 * Si no es responsable, total = base y IVA = 0.
 */
export function computeTaxedPrice(baseCop: number, config: TaxConfig): TaxedPrice {
  const base = Math.max(0, Math.round(Number(baseCop) || 0));
  if (!config.ivaResponsable || config.ivaRate <= 0) {
    return { baseCop: base, ivaCop: 0, totalCop: base, ivaApplies: false, ivaRate: config.ivaRate };
  }
  const ivaCop = Math.round(base * (config.ivaRate / 100));
  return { baseCop: base, ivaCop, totalCop: base + ivaCop, ivaApplies: true, ivaRate: config.ivaRate };
}

/** Tope de ingresos (COP) para volverse responsable de IVA: 3.500 UVT. */
export function ivaResponsableThresholdCop(config: TaxConfig): number {
  return Math.round(IVA_RESPONSABLE_UVT_THRESHOLD * config.uvtValue);
}
