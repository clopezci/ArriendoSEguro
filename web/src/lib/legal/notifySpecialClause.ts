import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { getLegalConfig } from "@/domain/legal/legalConfig";
import { sendEmail } from "@/services/email/sendEmail";
import { specialClauseReviewEmail } from "@/services/email/emailTemplates";
import { SPECIAL_CLAUSE_REVIEWS_COLLECTION } from "@/domain/contracts/specialClauseReview";

function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
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

  const snap = await firestore
    .collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION)
    .where("contractDraftId", "==", id)
    .limit(1)
    .get()
    .catch(() => null);
  if (!snap || snap.empty) return { notified: 0 };

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
