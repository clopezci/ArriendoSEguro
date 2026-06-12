import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getLegalConfig } from "@/domain/legal/legalConfig";
import { sendEmail } from "@/services/email/sendEmail";
import { specialClauseReviewEmail } from "@/services/email/emailTemplates";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

/**
 * Cláusula especial «Otra» (texto libre): tiene un cobro adicional administrable
 * y dispara una solicitud de revisión al aliado jurídico configurado en `/admin`.
 *
 * - GET: devuelve el precio vigente (para mostrarlo en el wizard).
 * - POST: notifica por correo al aliado jurídico (con dedupe por expediente).
 */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  const config = await getLegalConfig(firestore);
  return NextResponse.json({
    success: true,
    priceCop: config.specialClausePriceCop,
    hasLegalPartner: (config.legalPartnerEmails?.length ?? 0) > 0,
  });
  void request;
}

const postSchema = z.object({
  contractDraftId: z.string().min(1),
  clauseText: z.string().min(10).max(2000),
});

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }
  const { contractDraftId, clauseText } = parsed.data;

  const config = await getLegalConfig(firestore);
  const emails = config.legalPartnerEmails ?? [];
  // Sin aliado jurídico configurado: no es un error del usuario, simplemente no
  // hay a quién avisar todavía.
  if (emails.length === 0) {
    return NextResponse.json({ success: true, notified: 0, reason: "no_legal_partner" });
  }

  // Dedupe: si ya enviamos la solicitud para este expediente, no repetimos.
  try {
    const prior = await firestore
      .collection("email_logs")
      .where("relatedEntityId", "==", contractDraftId)
      .where("templateCode", "==", "specialClauseReviewEmail")
      .limit(1)
      .get();
    if (!prior.empty) {
      return NextResponse.json({ success: true, notified: 0, reason: "already_notified" });
    }
  } catch {
    /* si la consulta falla, seguimos e intentamos enviar igual */
  }

  const tpl = specialClauseReviewEmail({
    contractId: contractDraftId,
    requesterEmail: auth.user.email ?? "(sin correo)",
    clauseText,
    priceCop: config.specialClausePriceCop,
  });

  let notified = 0;
  for (const to of emails) {
    const r = await sendEmail({
      to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      templateCode: "specialClauseReviewEmail",
      relatedEntityType: "contract",
      relatedEntityId: contractDraftId,
    });
    if (r.status === "sent" || r.status === "mock") notified += 1;
  }
  auditEvent("special_clause_review_requested", { contractId: contractDraftId, recipients: emails.length });
  return NextResponse.json({ success: true, notified });
}
