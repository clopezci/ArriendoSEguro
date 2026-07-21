import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { SPECIAL_CLAUSE_REVIEWS_COLLECTION } from "@/domain/contracts/specialClauseReview";
import { auditEvent } from "@/features/contracts/audit-server";
import { sendEmail } from "@/services/email/sendEmail";

export const runtime = "nodejs";

const DRAFTS_COLLECTION = "contract_drafts";

/**
 * Página del aliado jurídico para registrar la cláusula «Otra» final.
 * Acceso por TOKEN (el enlace del correo es el secreto); no requiere login,
 * igual que los enlaces de invitación de las contrapartes.
 *
 * - GET: devuelve la solicitud (texto propuesto, contacto, estado).
 * - POST: guarda la cláusula final (o la marca como no procedente). Al quedar
 *   "drafted", el texto final se incorpora automáticamente al contrato del
 *   usuario (se escribe en la revisión —fuente de verdad— y, best-effort, en el
 *   borrador `contract_drafts`).
 */
type ReviewDoc = {
  token?: string;
  contractDraftId?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;
  proposedText?: string;
  finalText?: string;
  priceCop?: number;
  status?: string;
  createdAt?: string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "server_unavailable" }, { status: 503 });
  }
  const snap = await firestore.collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION).doc(token).get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }
  const r = snap.data() as ReviewDoc;
  return NextResponse.json({
    success: true,
    review: {
      contractId: r.contractDraftId ?? "",
      requesterName: r.requesterName ?? "",
      requesterEmail: r.requesterEmail ?? "",
      requesterPhone: r.requesterPhone ?? "",
      proposedText: r.proposedText ?? "",
      finalText: r.finalText ?? "",
      priceCop: r.priceCop ?? 0,
      status: r.status ?? "pending",
    },
  });
}

const postSchema = z.object({
  action: z.enum(["draft", "decline"]).default("draft"),
  finalText: z.string().max(4000).optional(),
  reviewerName: z.string().max(160).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "server_unavailable" }, { status: 503 });
  }
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 422 });
  }
  const { action, reviewerName } = parsed.data;
  const finalText = (parsed.data.finalText ?? "").trim();

  if (action === "draft" && finalText.length < 10) {
    return NextResponse.json({ success: false, error: "final_text_too_short" }, { status: 422 });
  }

  const ref = firestore.collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION).doc(token);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }
  const review = snap.data() as ReviewDoc;
  const nowIso = new Date().toISOString();
  const status = action === "decline" ? "declined" : "drafted";

  await ref.set(
    {
      status,
      finalText: action === "draft" ? finalText : "",
      reviewerName: (reviewerName ?? "").trim(),
      respondedAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true },
  );

  // Auto-actualización al contrato: escribimos también en el borrador (best-effort),
  // así la versión final rige aunque el dueño no vuelva a abrir el paso. La colección
  // de revisiones es la fuente de verdad; el cliente re-sincroniza al abrirse.
  const contractDraftId = review.contractDraftId;
  if (contractDraftId) {
    try {
      const draftRef = firestore.collection(DRAFTS_COLLECTION).doc(contractDraftId);
      const draftSnap = await draftRef.get();
      if (draftSnap.exists) {
        const payload = ((draftSnap.data() as { payload?: Record<string, unknown> }).payload ?? {}) as Record<string, unknown>;
        const sc = (payload.specialClauses ?? {}) as Record<string, unknown>;
        await draftRef.set(
          {
            payload: {
              ...payload,
              specialClauses: {
                ...sc,
                reviewStatus: status,
                finalText: action === "draft" ? finalText : "",
                reviewToken: token,
              },
            },
          },
          { merge: true },
        );
      }
    } catch {
      /* si el borrador ya no existe, la revisión sigue siendo la fuente de verdad */
    }
  }

  // Aviso al CLIENTE (dueño) de que su cláusula ya fue resuelta (best-effort).
  const ownerEmail = (review.requesterEmail ?? "").trim();
  if (ownerEmail) {
    const base = (process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://arriendoseguro.app").replace(/\/$/, "");
    const link = contractDraftId ? `${base}/dashboard/contracts/${contractDraftId}/preview` : base;
    const isDrafted = status === "drafted";
    const subject = isDrafted ? "Tu cláusula especial ya está lista ✅" : "Sobre tu cláusula especial";
    const body = isDrafted
      ? `Hola,\n\nEl abogado revisó y registró la redacción FINAL de tu cláusula especial «Otra». Ya quedó incorporada a tu contrato en ArriendoSeguro.\n\nÁbrelo para ver la versión final: ${link}\n\n— ArriendoSeguro`
      : `Hola,\n\nEl abogado revisó tu cláusula especial «Otra» y indicó que NO procede tal como estaba redactada. Puedes ajustarla o retirarla desde tu contrato. Si ya pagaste su valor, escríbenos para gestionarlo.\n\nTu contrato: ${link}\n\n— ArriendoSeguro`;
    const html = `<p>Hola,</p>${isDrafted
      ? `<p>El abogado revisó y registró la redacción <strong>FINAL</strong> de tu cláusula especial «Otra». Ya quedó incorporada a tu contrato en ArriendoSeguro.</p><p><a href="${link}">Abre tu contrato para ver la versión final →</a></p>`
      : `<p>El abogado revisó tu cláusula especial «Otra» e indicó que <strong>no procede</strong> tal como estaba redactada. Puedes ajustarla o retirarla desde tu contrato. Si ya pagaste su valor, escríbenos para gestionarlo.</p><p><a href="${link}">Ir a tu contrato →</a></p>`}<p>— ArriendoSeguro</p>`;
    await sendEmail({
      to: ownerEmail,
      subject,
      html,
      text: body,
      templateCode: "specialClauseResolvedOwner",
      relatedEntityType: "contract",
      relatedEntityId: contractDraftId ?? "",
    }).catch(() => {});
  }

  auditEvent("special_clause_review_answered", { contractId: contractDraftId ?? "", status });
  return NextResponse.json({ success: true, status });
}
