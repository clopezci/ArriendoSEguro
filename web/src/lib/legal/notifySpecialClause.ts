import "server-only";
import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getLegalConfig } from "@/domain/legal/legalConfig";
import { sendEmail } from "@/services/email/sendEmail";
import { specialClauseReviewEmail } from "@/services/email/emailTemplates";
import { SPECIAL_CLAUSE_REVIEWS_COLLECTION } from "@/domain/contracts/specialClauseReview";
import { SPECIAL_CLAUSE_OTHER_ID } from "@/features/contracts/special-clauses";

function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Contacto del creador (dueño) desde el payload del borrador. */
function readOwnerContact(payload: unknown): { name: string; email: string; phone: string } {
  const p = (payload ?? {}) as Record<string, unknown>;
  const ll = (p.landlord ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    name: str(ll.fullName) || str(p.name),
    email: str(ll.email) || str(p.email),
    phone: str(ll.phone) || str(p.phone),
  };
}

/**
 * Crea la revisión de la cláusula «Otra» a partir del BORRADOR si aún no existe.
 * El flujo /nuevo guarda la cláusula en el borrador pero no crea la revisión; sin
 * esto, al pagar el abogado nunca recibiría el correo. Devuelve el id creado o null.
 */
async function createReviewFromDraftIfNeeded(firestore: Firestore, contractDraftId: string): Promise<string | null> {
  const draftSnap = await firestore.collection("contract_drafts").doc(contractDraftId).get().catch(() => null);
  if (!draftSnap || !draftSnap.exists) return null;
  const payload = (draftSnap.data() as { payload?: Record<string, unknown>; ownerUid?: string }).payload ?? {};
  const ownerUid = (draftSnap.data() as { ownerUid?: string }).ownerUid ?? "";
  const sc = (payload.specialClauses ?? {}) as { enabled?: boolean; selected?: string[]; freeText?: string; otherCount?: number };
  const hasOther = Boolean(sc.enabled) && Array.isArray(sc.selected) && sc.selected.includes(SPECIAL_CLAUSE_OTHER_ID);
  const clauseText = (sc.freeText ?? "").trim();
  if (!hasOther || clauseText.length < 5) return null;

  const owner = readOwnerContact(payload);
  const config = await getLegalConfig(firestore);
  const token = randomUUID().replace(/-/g, "");
  const nowIso = new Date().toISOString();
  await firestore.collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION).doc(token).set({
    token,
    contractDraftId,
    ownerUid,
    requesterName: owner.name,
    requesterEmail: owner.email,
    requesterPhone: owner.phone,
    proposedText: clauseText,
    otherCount: Math.max(1, Math.floor(Number(sc.otherCount) || 1)),
    priceCop: config.specialClausePriceCop,
    status: "pending",
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return token;
}

/**
 * Notifica al aliado jurídico la cláusula «Otra» **solo cuando el contrato ya se
 * pagó**. Antes del pago no se molesta al abogado; si el usuario no paga o quita
 * la cláusula, este correo nunca sale. Idempotente (marca `emailSentAt`).
 */
export async function notifyLegalPartnerForPaidClause(
  firestore: Firestore,
  leaseProcessId: string | null | undefined,
): Promise<{ notified: number }> {
  const id = (leaseProcessId ?? "").trim();
  if (!id) return { notified: 0 };

  let snap = await firestore
    .collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION)
    .where("contractDraftId", "==", id)
    .limit(1)
    .get()
    .catch(() => null);

  // Si no hay revisión (flujo /nuevo), la creamos desde el borrador al pagar.
  if (!snap || snap.empty) {
    const created = await createReviewFromDraftIfNeeded(firestore, id).catch(() => null);
    if (!created) return { notified: 0 };
    snap = await firestore
      .collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION)
      .where("contractDraftId", "==", id)
      .limit(1)
      .get()
      .catch(() => null);
    if (!snap || snap.empty) return { notified: 0 };
  }

  const doc = snap.docs[0];
  const r = doc.data() as {
    status?: string;
    emailSentAt?: string;
    proposedText?: string;
    priceCop?: number;
    requesterName?: string;
    requesterEmail?: string;
    requesterPhone?: string;
  };
  // No notificar si la cláusula fue cancelada/declinada o si ya se avisó.
  if (r.status === "cancelled" || r.status === "declined" || r.emailSentAt) return { notified: 0 };

  const config = await getLegalConfig(firestore);
  const emails = config.legalPartnerEmails ?? [];
  if (emails.length === 0) {
    // Sin aliado configurado: marcamos como "pagada" para el semáforo, sin correo.
    await doc.ref.set({ paidAt: new Date().toISOString() }, { merge: true });
    return { notified: 0 };
  }

  const reviewUrl = `${appBaseUrl()}/aliado/clausula/${doc.id}`;
  const tpl = specialClauseReviewEmail({
    contractId: id,
    requesterName: r.requesterName ?? "",
    requesterEmail: r.requesterEmail ?? "",
    requesterPhone: r.requesterPhone ?? "",
    clauseText: (r.proposedText ?? "").trim(),
    priceCop: Number(r.priceCop ?? 0),
    reviewUrl,
  });

  let notified = 0;
  for (const to of emails) {
    const res = await sendEmail({
      to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      templateCode: "specialClauseReviewEmail",
      relatedEntityType: "contract",
      relatedEntityId: id,
    });
    if (res.status === "sent" || res.status === "mock") notified += 1;
  }
  await doc.ref.set(
    { emailSentAt: new Date().toISOString(), paidAt: new Date().toISOString() },
    { merge: true },
  );
  return { notified };
}
