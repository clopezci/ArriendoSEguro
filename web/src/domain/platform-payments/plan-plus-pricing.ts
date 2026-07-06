/**
 * Precio efectivo del Plan Plus (checkout) configurable por admins vía Firestore
 * `app_settings/plan_plus_pricing`.
 *
 * Modelo:
 *  - `listCop`  = precio pleno / de lista (por defecto $89.900).
 *  - `mode`     = "full" (se cobra el precio pleno, sin promoción) o
 *                 "promo" (hay una promoción vigente).
 *  - Cuando hay promoción, puede ser por **precio fijo** (`promoFixedCop`) o por
 *    **% de descuento** sobre el precio pleno (`promoPercent`), y siempre lleva
 *    un **nombre** (`promoName`) y un **mensaje** (`promoMessage`) que el admin
 *    define, p. ej. "Precio promocional por tiempo limitado".
 *
 * Si no existe el documento, se usa la promoción de lanzamiento por defecto
 * ($49.900 versus $89.900). Se mantiene compatibilidad con el esquema anterior
 * basado en `preset` (promo_49900 / list_89900 / custom).
 */

import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  CONTRACT_EARLY_BIRD_PRICE_COP,
  CONTRACT_LIST_PRICE_COP,
} from "@/lib/product-pricing";

export const PLAN_PLUS_PRICING_COLLECTION = "app_settings";
export const PLAN_PLUS_PRICING_DOC_ID = "plan_plus_pricing";

export type PlanPlusPricingMode = "full" | "promo";
export type PlanPlusPromoType = "fixed" | "percent";

/** Límites en COP (evita typos graves). */
const CUSTOM_MIN_COP = 5_000;
const CUSTOM_MAX_COP = 999_999;
export const PLAN_PLUS_CUSTOM_COP_LIMITS = { min: CUSTOM_MIN_COP, max: CUSTOM_MAX_COP };

/** Textos por defecto de la promoción de lanzamiento. */
export const DEFAULT_PROMO_NAME = "Lanzamiento";
export const DEFAULT_PROMO_MESSAGE = "Promoción de lanzamiento por tiempo limitado";

/** Esquema nuevo (promociones con nombre/mensaje). */
const storedSchema = z.object({
  mode: z.enum(["full", "promo"]),
  listCop: z.number().int().min(CUSTOM_MIN_COP).max(CUSTOM_MAX_COP).optional(),
  promoType: z.enum(["fixed", "percent"]).optional(),
  promoFixedCop: z.number().int().min(CUSTOM_MIN_COP).max(CUSTOM_MAX_COP).nullable().optional(),
  promoPercent: z.number().min(0.1).max(95).nullable().optional(),
  promoName: z.string().max(60).nullable().optional(),
  promoMessage: z.string().max(160).nullable().optional(),
  updatedAt: z.string().optional(),
  updatedByEmail: z.string().optional(),
});

/** Esquema anterior (compatibilidad hacia atrás). */
const legacySchema = z.object({
  preset: z.enum(["promo_49900", "list_89900", "custom"]),
  customCheckoutCop: z.number().int().positive().max(CUSTOM_MAX_COP).nullable().optional(),
  customListCop: z.number().int().positive().max(CUSTOM_MAX_COP).nullable().optional(),
});

export type ResolvedPlanPlusPricing = {
  /** Precio que cobra hoy el checkout. */
  checkoutCop: number;
  /** Precio pleno / de lista (tachado en UI cuando hay promoción). */
  listCompareCop: number;
  /** Si hay una promoción vigente (checkout < lista). */
  isPromo: boolean;
  /** Nombre de la promoción vigente (o null si no hay). */
  promoName: string | null;
  /** Mensaje de la promoción vigente (o null si no hay). */
  promoMessage: string | null;
  /** Configuración (para reconstruir el editor de admin). */
  mode: PlanPlusPricingMode;
  promoType: PlanPlusPromoType | null;
  promoPercent: number | null;
};

function clampCop(n: number): number {
  return Math.min(CUSTOM_MAX_COP, Math.max(CUSTOM_MIN_COP, Math.floor(n)));
}

/** Redondea a la centena de peso más cercana (para descuentos por %). */
function roundToHundred(n: number): number {
  return Math.round(n / 100) * 100;
}

export function getDefaultResolvedPlanPlusPricing(): ResolvedPlanPlusPricing {
  return {
    checkoutCop: CONTRACT_EARLY_BIRD_PRICE_COP,
    listCompareCop: CONTRACT_LIST_PRICE_COP,
    isPromo: true,
    promoName: DEFAULT_PROMO_NAME,
    promoMessage: DEFAULT_PROMO_MESSAGE,
    mode: "promo",
    promoType: "fixed",
    promoPercent: null,
  };
}

function resolveNew(data: z.infer<typeof storedSchema>): ResolvedPlanPlusPricing {
  const listCop = clampCop(data.listCop ?? CONTRACT_LIST_PRICE_COP);

  if (data.mode === "full") {
    return {
      checkoutCop: listCop,
      listCompareCop: listCop,
      isPromo: false,
      promoName: null,
      promoMessage: null,
      mode: "full",
      promoType: null,
      promoPercent: null,
    };
  }

  const promoType: PlanPlusPromoType = data.promoType ?? "fixed";
  let checkout: number;
  let promoPercent: number | null = null;
  if (promoType === "percent") {
    const pct = data.promoPercent ?? 0;
    promoPercent = pct;
    checkout = clampCop(roundToHundred(listCop * (1 - pct / 100)));
  } else {
    checkout = data.promoFixedCop != null ? clampCop(data.promoFixedCop) : CONTRACT_EARLY_BIRD_PRICE_COP;
  }
  // La promoción nunca puede superar el precio pleno.
  if (checkout > listCop) checkout = listCop;
  const isPromo = checkout < listCop;

  return {
    checkoutCop: checkout,
    listCompareCop: listCop,
    isPromo,
    promoName: isPromo ? (data.promoName?.trim() || DEFAULT_PROMO_NAME) : null,
    promoMessage: isPromo ? (data.promoMessage?.trim() || DEFAULT_PROMO_MESSAGE) : null,
    mode: "promo",
    promoType,
    promoPercent,
  };
}

function resolveLegacy(data: z.infer<typeof legacySchema>): ResolvedPlanPlusPricing {
  if (data.preset === "list_89900") {
    return {
      checkoutCop: CONTRACT_LIST_PRICE_COP,
      listCompareCop: CONTRACT_LIST_PRICE_COP,
      isPromo: false,
      promoName: null,
      promoMessage: null,
      mode: "full",
      promoType: null,
      promoPercent: null,
    };
  }
  if (data.preset === "custom" && data.customCheckoutCop != null) {
    const checkout = clampCop(data.customCheckoutCop);
    const fallbackList = checkout < CONTRACT_LIST_PRICE_COP ? CONTRACT_LIST_PRICE_COP : checkout;
    const listCompare =
      data.customListCop != null && data.customListCop >= checkout
        ? clampCop(data.customListCop)
        : fallbackList;
    const isPromo = checkout < listCompare;
    return {
      checkoutCop: checkout,
      listCompareCop: listCompare,
      isPromo,
      promoName: isPromo ? DEFAULT_PROMO_NAME : null,
      promoMessage: isPromo ? DEFAULT_PROMO_MESSAGE : null,
      mode: "promo",
      promoType: "fixed",
      promoPercent: null,
    };
  }
  // promo_49900 (o custom sin monto): promoción de lanzamiento por defecto.
  return getDefaultResolvedPlanPlusPricing();
}

export function resolvePlanPlusPricingFromFirestoreData(stored: unknown): ResolvedPlanPlusPricing {
  const neu = storedSchema.safeParse(stored);
  if (neu.success) return resolveNew(neu.data);
  const legacy = legacySchema.safeParse(stored);
  if (legacy.success) return resolveLegacy(legacy.data);
  return getDefaultResolvedPlanPlusPricing();
}

export async function getResolvedPlanPlusPricing(firestore: Firestore): Promise<ResolvedPlanPlusPricing> {
  const snap = await firestore.collection(PLAN_PLUS_PRICING_COLLECTION).doc(PLAN_PLUS_PRICING_DOC_ID).get();
  if (!snap.exists) return getDefaultResolvedPlanPlusPricing();
  return resolvePlanPlusPricingFromFirestoreData(snap.data());
}

export async function getPlanPlusPricingForPublicPages(
  firestore: Firestore | null | undefined,
): Promise<ResolvedPlanPlusPricing> {
  if (!firestore) return getDefaultResolvedPlanPlusPricing();
  try {
    return await getResolvedPlanPlusPricing(firestore);
  } catch {
    // Build estático, certificados o red: no bloquear prerender; runtime en servidor volverá a intentar.
    return getDefaultResolvedPlanPlusPricing();
  }
}

export function formatPlanPlusPriceLineCheckoutAndList(checkoutCop: number, listCompareCop: number): string {
  if (checkoutCop < listCompareCop) {
    return `${formatCopInline(listCompareCop)} lista · ${formatCopInline(checkoutCop)} vigente por contrato`;
  }
  return `${formatCopInline(checkoutCop)} vigente por contrato`;
}

function formatCopInline(amount: number): string {
  return `$${amount.toLocaleString("es-CO")} COP`;
}
