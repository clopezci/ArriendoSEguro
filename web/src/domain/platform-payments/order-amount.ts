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
import { SPECIAL_CLAUSE_REVIEWS_COLLECTION } from "@/domain/contracts/specialClauseReview";
import { getTaxConfig } from "@/lib/tax/serverTaxConfig";
import { computeTaxedPrice } from "@/domain/tax/taxConfig";

export type OrderLineItem = { code: string; label: string; amountCop: number };

export type PlanPlusOrderAmount = {
  planPlusCop: number;
  listCompareCop: number;
  clauseCop: number;
  hasCostedClause: boolean;
  /** Subtotal antes de IVA (Plan Plus + cláusulas). */
  subtotalCop: number;
  /** IVA aplicado (0 si la empresa no es responsable de IVA). */
  ivaCop: number;
  /** Tarifa de IVA aplicada (%). */
  ivaRate: number;
  /** ¿Se aplicó IVA a esta orden? */
  ivaApplies: boolean;
  /** Total a cobrar (subtotal + IVA). */
  totalCop: number;
  lineItems: OrderLineItem[];
  promoName: string | null;
  promoMessage: string | null;
};

type ScShape = { enabled?: boolean; selected?: string[]; otherCount?: number };

function scHasOther(sc: ScShape | undefined): boolean {
  return Boolean(sc?.enabled) && Array.isArray(sc?.selected) && sc.selected.includes(SPECIAL_CLAUSE_OTHER_ID);
}

/** Número de cláusulas «Otra» (con costo): 0 si no hay; si hay, al menos 1. */
function scOtherCount(sc: ScShape | undefined): number {
  if (!scHasOther(sc)) return 0;
  return Math.min(20, Math.max(1, Math.floor(Number(sc?.otherCount) || 1)));
}

/**
 * ¿El expediente incluye la cláusula «Otra» (con costo)? Se evalúa priorizando la
 * **selección ACTUAL** del usuario, para que el cobro aparezca aunque haya restos
 * de pruebas anteriores:
 *  1) **Borrador vivo** (contract_drafts): si tiene «Otra», cobra. Es la selección
 *     que el usuario ve en pantalla. Una revisión "cancelada" de una prueba previa
 *     NO debe bloquear una cláusula re-agregada.
 *  2) **Revisión ACTIVA** (pendiente/borrador) como respaldo si el borrador aún no
 *     se sincronizó al servidor. Una revisión cancelada/declinada NO aporta cobro.
 *  3) **Versión guardada** (contract_versions) como último recurso.
 *
 * Al "Quitar la cláusula", el endpoint de remoción limpia borrador + versión y
 * cancela la revisión, así que las tres señales quedan en falso → no cobra.
 */
async function leaseSpecialClauseUnits(firestore: Firestore, leaseProcessId: string): Promise<number> {
  try {
    // 1) Borrador vivo (selección actual del usuario) manda.
    const draftSnap = await firestore.collection("contract_drafts").doc(leaseProcessId).get();
    const draftSc = (draftSnap.data() as { payload?: { specialClauses?: ScShape } } | undefined)?.payload?.specialClauses;
    const draftUnits = scOtherCount(draftSc);
    if (draftUnits > 0) return draftUnits;

    // 2) Revisión ACTIVA (pendiente/borrador) como respaldo. Cancelada/declinada NO cobra.
    const revSnap = await firestore
      .collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION)
      .where("contractDraftId", "==", leaseProcessId)
      .limit(1)
      .get();
    if (!revSnap.empty) {
      const r = revSnap.docs[0].data() as { status?: string; otherCount?: number };
      const st = String(r.status ?? "pending");
      if (st !== "cancelled" && st !== "declined") return Math.min(20, Math.max(1, Math.floor(Number(r.otherCount) || 1)));
    }

    // 3) Versión guardada.
    const contractSnap = await firestore.collection("contracts").doc(leaseProcessId).get();
    const currentVersionId = (contractSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId;
    if (!currentVersionId) return 0;
    const versionSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const sc = (versionSnap.data() as { contractPayload?: { specialClauses?: ScShape } } | undefined)?.contractPayload?.specialClauses;
    return scOtherCount(sc);
  } catch {
    return 0;
  }
}

/**
 * Diagnóstico: devuelve las tres señales crudas que decide `leaseHasCostedSpecialClause`,
 * para depurar por qué un expediente cobra (o no) la cláusula «Otra» SIN adivinar.
 * Se expone en `order-preview?debug=1` (solo dueño autenticado).
 */
export async function debugSpecialClauseSignals(
  firestore: Firestore,
  leaseProcessId: string,
): Promise<{
  otherId: string;
  draftExists: boolean;
  draftSelected: string[] | null;
  draftHasOther: boolean;
  reviewExists: boolean;
  reviewStatus: string | null;
  reviewCounts: boolean;
  versionId: string | null;
  versionSelected: string[] | null;
  versionHasOther: boolean;
  decision: boolean;
}> {
  const out = {
    otherId: SPECIAL_CLAUSE_OTHER_ID,
    draftExists: false,
    draftSelected: null as string[] | null,
    draftHasOther: false,
    reviewExists: false,
    reviewStatus: null as string | null,
    reviewCounts: false,
    versionId: null as string | null,
    versionSelected: null as string[] | null,
    versionHasOther: false,
    decision: false,
  };
  try {
    const draftSnap = await firestore.collection("contract_drafts").doc(leaseProcessId).get();
    out.draftExists = draftSnap.exists;
    const draftSc = (
      draftSnap.data() as { payload?: { specialClauses?: { enabled?: boolean; selected?: string[] } } } | undefined
    )?.payload?.specialClauses;
    out.draftSelected = Array.isArray(draftSc?.selected) ? draftSc!.selected! : null;
    out.draftHasOther = scHasOther(draftSc);

    const revSnap = await firestore
      .collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION)
      .where("contractDraftId", "==", leaseProcessId)
      .limit(1)
      .get();
    out.reviewExists = !revSnap.empty;
    if (!revSnap.empty) {
      const st = String((revSnap.docs[0].data() as { status?: string }).status ?? "pending");
      out.reviewStatus = st;
      out.reviewCounts = st !== "cancelled" && st !== "declined";
    }

    const contractSnap = await firestore.collection("contracts").doc(leaseProcessId).get();
    const currentVersionId = (contractSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId ?? null;
    out.versionId = currentVersionId;
    if (currentVersionId) {
      const versionSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
      const sc = (
        versionSnap.data() as
          | { contractPayload?: { specialClauses?: { enabled?: boolean; selected?: string[] } } }
          | undefined
      )?.contractPayload?.specialClauses;
      out.versionSelected = Array.isArray(sc?.selected) ? sc!.selected! : null;
      out.versionHasOther = scHasOther(sc);
    }
    out.decision = out.draftHasOther || out.reviewCounts || out.versionHasOther;
  } catch {
    /* mejor esfuerzo: devolvemos lo que se pudo leer */
  }
  return out;
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
  let clauseUnits = 0;
  if (opts.leaseProcessId) {
    clauseUnits = await leaseSpecialClauseUnits(firestore, opts.leaseProcessId);
    if (clauseUnits > 0) {
      const legal = await getLegalConfig(firestore);
      const unitCop = Math.max(0, Math.floor(Number(legal.specialClausePriceCop) || 0));
      clauseCop = unitCop * clauseUnits;
      if (clauseCop > 0) {
        lineItems.push({
          code: "special_clause_other",
          label: clauseUnits > 1
            ? `Cláusulas personalizadas «Otra» (${clauseUnits} × $${unitCop.toLocaleString("es-CO")})`
            : "Cláusula personalizada «Otra»",
          amountCop: clauseCop,
        });
      }
    }
  }

  const hasCharge = clauseUnits > 0 && clauseCop > 0;

  // IVA: se AGREGA al subtotal solo si la empresa es responsable de IVA. Server-
  // authoritative: el total que se cobra ya incluye el IVA cuando aplica.
  const subtotalCop = planPlusCop + clauseCop;
  const taxCfg = await getTaxConfig(firestore);
  const taxed = computeTaxedPrice(subtotalCop, taxCfg);
  if (taxed.ivaApplies && taxed.ivaCop > 0) {
    lineItems.push({
      code: "iva",
      label: `IVA (${taxed.ivaRate}%)`,
      amountCop: taxed.ivaCop,
    });
  }

  return {
    planPlusCop,
    listCompareCop: pricing.listCompareCop,
    clauseCop,
    hasCostedClause: hasCharge,
    subtotalCop,
    ivaCop: taxed.ivaCop,
    ivaRate: taxed.ivaRate,
    ivaApplies: taxed.ivaApplies,
    totalCop: taxed.totalCop,
    lineItems,
    promoName: pricing.promoName,
    promoMessage: pricing.promoMessage,
  };
}
