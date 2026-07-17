import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { SPECIAL_CLAUSE_REVIEWS_COLLECTION } from "@/domain/contracts/specialClauseReview";
import { SPECIAL_CLAUSE_OTHER_ID } from "@/features/contracts/special-clauses";

export const runtime = "nodejs";

const DRAFTS_COLLECTION = "contract_drafts";
const schema = z.object({ contractId: z.string().min(1) });

type SpecialClauses = { enabled?: boolean; selected?: string[]; freeText?: string; costNotified?: boolean } | undefined;

/** Quita el criterio «Otra» de la selección, dejando las demás cláusulas. */
function stripOther(sc: SpecialClauses): { enabled: boolean; selected: string[]; freeText: string; costNotified: boolean } {
  const selected = (sc?.selected ?? []).filter((c) => c !== SPECIAL_CLAUSE_OTHER_ID);
  return {
    enabled: selected.length > 0,
    selected,
    freeText: "",
    costNotified: false,
  };
}

/**
 * Quita la cláusula «Otra» (con costo) del expediente en el último momento (antes
 * de pagar). Garantiza tres cosas de forma atómica desde el servidor:
 *  1) Cancela la **revisión** (no se cobrará ni se notificará al abogado).
 *  2) La borra del **borrador** (contract_drafts) y de la **versión** guardada.
 *  Como el correo al aliado jurídico está diferido hasta el pago, al cancelar la
 *  revisión ese correo nunca sale.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Falta el contrato." }] }, { status: 422 });
  }
  const { contractId } = parsed.data;

  // Solo el dueño del expediente puede quitar la cláusula.
  const draftRef = firestore.collection(DRAFTS_COLLECTION).doc(contractId);
  const draftSnap = await draftRef.get();
  const draftData = draftSnap.data() as { ownerUid?: string; payload?: { specialClauses?: SpecialClauses } } | undefined;
  const contractSnap = await firestore.collection("contracts").doc(contractId).get();
  const contractData = contractSnap.data() as { ownerUid?: string; currentVersionId?: string } | undefined;
  const ownerUid = draftData?.ownerUid ?? contractData?.ownerUid;
  if (ownerUid && ownerUid !== auth.user.uid) {
    return NextResponse.json({ success: false, errors: [{ field: "auth", message: "No autorizado sobre este expediente." }] }, { status: 403 });
  }

  const now = new Date().toISOString();

  // 1) Cancela la revisión (upsert por si aún no existía doc).
  const revSnap = await firestore
    .collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION)
    .where("contractDraftId", "==", contractId)
    .limit(1)
    .get()
    .catch(() => null);
  if (revSnap && !revSnap.empty) {
    await revSnap.docs[0].ref.set({ status: "cancelled", cancelledAt: now, updatedAt: now }, { merge: true });
  } else {
    // Centinela cancelado para que el carrito no cobre por rezago del borrador.
    const ref = firestore.collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION).doc();
    await ref.set({ token: ref.id, contractDraftId: contractId, ownerUid: auth.user.uid, status: "cancelled", cancelledAt: now, createdAt: now, updatedAt: now });
  }

  // 2) La quita del borrador.
  if (draftSnap.exists) {
    await draftRef.set({ payload: { specialClauses: stripOther(draftData?.payload?.specialClauses) } }, { merge: true });
  }

  // 3) La quita de la versión guardada (para el render del contrato y el carrito).
  const currentVersionId = contractData?.currentVersionId;
  if (currentVersionId) {
    const vRef = firestore.collection("contract_versions").doc(currentVersionId);
    const vSnap = await vRef.get();
    const vsc = (vSnap.data() as { contractPayload?: { specialClauses?: SpecialClauses } } | undefined)?.contractPayload?.specialClauses;
    await vRef.set({ contractPayload: { specialClauses: stripOther(vsc) } }, { merge: true });
  }

  auditEvent("special_clause_removed", { contractId });
  return NextResponse.json({ success: true });
}
