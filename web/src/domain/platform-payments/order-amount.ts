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

function scHasOther(sc: { enabled?: boolean; selected?: string[] } | undefined): boolean {
  return Boolean(sc?.enabled) && Array.isArray(sc?.selected) && sc.selected.includes(SPECIAL_CLAUSE_OTHER_ID);
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
async function leaseHasCostedSpecialClause(firestore: Firestore, leaseProcessId: string): Promise<boolean> {
  try {
    // 1) Borrador vivo (selección actual del usuario) manda.
    const draftSnap = await firestore.collection("contract_drafts").doc(leaseProcessId).get();
    const draftSc = (
      draftSnap.data() as { payload?: { specialClauses?: { enabled?: boolean; selected?: string[] } } } | undefined
    )?.payload?.specialClauses;
    if (scHasOther(draftSc)) return true;

    // 2) Revisión ACTIVA (pendiente/borrador) como respaldo. Cancelada/declinada NO cobra.
    const revSnap = await firestore
      .collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION)
      .where("contractDraftId", "==", leaseProcessId)
      .limit(1)
      .get();
    if (!revSnap.empty) {
      const st = String((revSnap.docs[0].data() as { status?: string }).status ?? "pending");
      if (st !== "cancelled" && st !== "declined") return true;
    }

    // 3) Versión guardada.
    const contractSnap = await firestore.collection("contracts").doc(leaseProcessId).get();
    const currentVersionId = (contractSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId;
    if (!currentVersionId) return false;
    const versionSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const sc = (
      versionSnap.data() as
        | { contractPayload?: { specialClauses?: { enabled?: boolean; selected?: string[] } } }
        | undefined
    )?.contractPayload?.specialClauses;
    return scHasOther(sc);
  } catch {
    return false;
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
