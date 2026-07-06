/**
 * Cálculo del monto de una orden de Plan Plus, incluyendo el complemento por la
 * cláusula especial «Otra» (texto libre) cuando el expediente la incluye.
 *
 * Es la ÚNICA fuente de verdad del total: se usa tanto para mostrar el carrito
 * (vista previa) como para crear la orden (create-order). Nunca se confía en un
 * monto enviado por el cliente.
 */

import type { Firestore } from "firebase-admin/firestore";
import { getResolvedPlanPlusPricing } from "./plan-plus-pricing";
import { getLegalConfig } from "@/domain/legal/legalConfig";
import { SPECIAL_CLAUSE_OTHER_ID } from "@/features/contracts/special-clauses";

export type OrderLineItem = { code: string; label: string; amountCop: number };

export type PlanPlusOrderAmount = {
  planPlusCop: number;
  listCompareCop: number;
  clauseCop: number;
  hasCostedClause: boolean;
  totalCop: number;
  lineItems: OrderLineItem[];
  promoName: string | null;
  promoMessage: string | null;
};

/** ¿El expediente incluye la cláusula «Otra» (con costo)? */
async function leaseHasCostedSpecialClause(firestore: Firestore, leaseProcessId: string): Promise<boolean> {
  try {
    const contractSnap = await firestore.collection("contracts").doc(leaseProcessId).get();
    const currentVersionId = (contractSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId;
    if (!currentVersionId) return false;
    const versionSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const sc = (
      versionSnap.data() as
        | { contractPayload?: { specialClauses?: { enabled?: boolean; selected?: string[] } } }
        | undefined
    )?.contractPayload?.specialClauses;
    if (!sc?.enabled) return false;
    return Array.isArray(sc.selected) && sc.selected.includes(SPECIAL_CLAUSE_OTHER_ID);
  } catch {
    return false;
  }
}

export async function computePlanPlusOrderAmount(
  firestore: Firestore,
  opts: { leaseProcessId?: string | null },
): Promise<PlanPlusOrderAmount> {
  const pricing = await getResolvedPlanPlusPricing(firestore);
  const planPlusCop = pricing.checkoutCop;
  const lineItems: OrderLineItem[] = [
    { code: "plan_plus", label: "Plan Plus (1 contrato)", amountCop: planPlusCop },
  ];

  let clauseCop = 0;
  let hasCostedClause = false;
  if (opts.leaseProcessId) {
    hasCostedClause = await leaseHasCostedSpecialClause(firestore, opts.leaseProcessId);
    if (hasCostedClause) {
      const legal = await getLegalConfig(firestore);
      clauseCop = Math.max(0, Math.floor(Number(legal.specialClausePriceCop) || 0));
      if (clauseCop > 0) {
        lineItems.push({
          code: "special_clause_other",
          label: "Cláusula personalizada «Otra»",
          amountCop: clauseCop,
        });
      }
    }
  }

  const hasCharge = hasCostedClause && clauseCop > 0;
  return {
    planPlusCop,
    listCompareCop: pricing.listCompareCop,
    clauseCop,
    hasCostedClause: hasCharge,
    totalCop: planPlusCop + clauseCop,
    lineItems,
    promoName: pricing.promoName,
    promoMessage: pricing.promoMessage,
  };
}
