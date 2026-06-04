/**
 * Precio efectivo del Plan Plus (checkout) configurable por admins vía Firestore `app_settings/plan_plus_pricing`.
 * Si no existe el documento, se usa promoción por defecto desde `product-pricing`.
 */

import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  CONTRACT_EARLY_BIRD_PRICE_COP,
  CONTRACT_LIST_PRICE_COP,
} from "@/lib/product-pricing";

export const PLAN_PLUS_PRICING_COLLECTION = "app_settings";
export const PLAN_PLUS_PRICING_DOC_ID = "plan_plus_pricing";

export type PlanPlusPricingPreset = "promo_49900" | "list_89900" | "custom";

/** Datos persistidos en Firestore (camelCase como el resto de platform_orders). */
const storedSchema = z.object({
  preset: z.enum(["promo_49900", "list_89900", "custom"]),
  customCheckoutCop: z.number().int().positive().max(999_999).nullable().optional(),
  /** Precio de lista (tachado) personalizado; si falta, se usa el de lista por defecto. */
  customListCop: z.number().int().positive().max(999_999).nullable().optional(),
  updatedAt: z.string().optional(),
  updatedByEmail: z.string().optional(),
});

export type ResolvedPlanPlusPricing = {
  checkoutCop: number;
  /** Comparación en UI (tachado) cuando hay promoción frente al precio de lista. */
  listCompareCop: number;
  preset: PlanPlusPricingPreset;
};

/** Límites para “otro” en COP (evita typos graves). */
const CUSTOM_MIN_COP = 5_000;
const CUSTOM_MAX_COP = 999_999;

function clampCustom(n: number): number {
  return Math.min(CUSTOM_MAX_COP, Math.max(CUSTOM_MIN_COP, Math.floor(n)));
}

export function getDefaultResolvedPlanPlusPricing(): ResolvedPlanPlusPricing {
  return {
    checkoutCop: CONTRACT_EARLY_BIRD_PRICE_COP,
    listCompareCop: CONTRACT_LIST_PRICE_COP,
    preset: "promo_49900",
  };
}

export function resolvePlanPlusPricingFromFirestoreData(stored: unknown): ResolvedPlanPlusPricing {
  const parsed = storedSchema.safeParse(stored);
  if (!parsed.success) return getDefaultResolvedPlanPlusPricing();

  const { preset, customCheckoutCop, customListCop } = parsed.data;
  if (preset === "promo_49900") {
    return {
      checkoutCop: CONTRACT_EARLY_BIRD_PRICE_COP,
      listCompareCop: CONTRACT_LIST_PRICE_COP,
      preset,
    };
  }
  if (preset === "list_89900") {
    return {
      checkoutCop: CONTRACT_LIST_PRICE_COP,
      listCompareCop: CONTRACT_LIST_PRICE_COP,
      preset,
    };
  }
  const raw = customCheckoutCop;
  if (raw == null || !Number.isInteger(raw)) {
    return getDefaultResolvedPlanPlusPricing();
  }
  const checkout = clampCustom(raw);
  // Precio de lista (tachado): si el admin definió uno personalizado y es mayor
  // o igual al precio vigente, se usa; si no, el de lista por defecto.
  const fallbackList = checkout < CONTRACT_LIST_PRICE_COP ? CONTRACT_LIST_PRICE_COP : checkout;
  const listCompare =
    customListCop != null && Number.isInteger(customListCop) && customListCop >= checkout
      ? clampCustom(customListCop)
      : fallbackList;
  return { checkoutCop: checkout, listCompareCop: listCompare, preset: "custom" };
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

export const PLAN_PLUS_CUSTOM_COP_LIMITS = { min: CUSTOM_MIN_COP, max: CUSTOM_MAX_COP };
