import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getLegalConfig } from "@/domain/legal/legalConfig";
import { auditEvent } from "@/features/contracts/audit-server";
import { SPECIAL_CLAUSE_REVIEWS_COLLECTION } from "@/domain/contracts/specialClauseReview";

export const runtime = "nodejs";

const DRAFTS_COLLECTION = "contract_drafts";

/** Extrae de forma defensiva el contacto del dueño desde el payload del borrador. */
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
 * Cláusula especial «Otra» (texto libre): tiene un cobro adicional administrable
 * y dispara una solicitud de revisión al aliado jurídico configurado en `/admin`.
 *
 * - GET sin parámetros: precio vigente + si hay aliado jurídico (para el wizard).
 * - GET ?contractDraftId=…: estado de la revisión de ESE expediente (dueño), para
 *   pintar el semáforo (rojo=en revisión / verde=cláusula final registrada).
 * - POST: crea la solicitud (colección `special_clause_reviews`) y notifica por
 *   correo al aliado jurídico con el contacto del creador y un enlace para
 *   registrar la cláusula final, que se incorpora automáticamente al contrato.
 */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  const contractDraftId = new URL(request.url).searchParams.get("contractDraftId");

  // Estado de la revisión del expediente (solo el dueño).
  if (contractDraftId) {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;
    if (!firestore) {
      return NextResponse.json({ success: true, hasReview: false, status: null });
    }
    // Verifica que el expediente sea del usuario antes de revelar nada.
    const draftSnap = await firestore.collection(DRAFTS_COLLECTION).doc(contractDraftId).get();
    if (!draftSnap.exists || (draftSnap.data() as { ownerUid?: string }).ownerUid !== auth.user.uid) {
      return NextResponse.json({ success: true, hasReview: false, status: null });
    }
    const snap = await firestore
      .collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION)
      .where("contractDraftId", "==", contractDraftId)
      .limit(1)
      .get();
    if (snap.empty) {
      return NextResponse.json({ success: true, hasReview: false, status: null });
    }
    const r = snap.docs[0].data() as { status?: string; finalText?: string; token?: string; respondedAt?: string };
    return NextResponse.json({
      success: true,
      hasReview: true,
      status: r.status ?? "pending",
      finalText: r.finalText ?? "",
      token: r.token ?? snap.docs[0].id,
      respondedAt: r.respondedAt ?? null,
    });
  }

  const config = await getLegalConfig(firestore);
  return NextResponse.json({
    success: true,
    priceCop: config.specialClausePriceCop,
    hasLegalPartner: (config.legalPartnerEmails?.length ?? 0) > 0,
  });
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

  // Contacto del creador del contrato (para que el abogado lo pueda contactar).
  const draftSnap = await firestore.collection(DRAFTS_COLLECTION).doc(contractDraftId).get();
  const owner = readOwnerContact((draftSnap.data() as { payload?: unknown } | undefined)?.payload);
  const requesterEmail = owner.email || auth.user.email || "(sin correo)";

  const reviewsCol = firestore.collection(SPECIAL_CLAUSE_REVIEWS_COLLECTION);
  const existingSnap = await reviewsCol.where("contractDraftId", "==", contractDraftId).limit(1).get();
  const existing = existingSnap.empty ? null : existingSnap.docs[0];
  const existingData = existing?.data() as { proposedText?: string; status?: string; token?: string } | undefined;

  const token = existing?.id ?? randomUUID().replace(/-/g, "");
  const nowIso = new Date().toISOString();
  const sameText = (existingData?.proposedText ?? "").trim() === clauseText.trim();

  await reviewsCol.doc(token).set(
    {
      token,
      contractDraftId,
      ownerUid: auth.user.uid,
      requesterName: owner.name,
      requesterEmail,
      requesterPhone: owner.phone,
      proposedText: clauseText.trim(),
      priceCop: config.specialClausePriceCop,
      // Si el usuario reeditó el texto, la revisión previa deja de ser válida
      // (y si ya se había notificado, se limpia para reenviar tras el pago).
      ...(existing && !sameText ? { status: "pending", finalText: "", respondedAt: null, emailSentAt: null } : {}),
      // Reactiva una revisión que estaba cancelada al volver a agregar la cláusula.
      ...(existingData?.status === "cancelled" ? { status: "pending", emailSentAt: null } : {}),
      ...(existing ? {} : { status: "pending", createdAt: nowIso }),
      updatedAt: nowIso,
    },
    { merge: true },
  );

  auditEvent("special_clause_review_requested", { contractId: contractDraftId, hasLegalPartner: emails.length > 0 });
  // IMPORTANTE: el correo al aliado jurídico NO se envía aquí. Se difiere hasta
  // que el contrato se PAGUE (webhook / mock-approve) mediante
  // notifyLegalPartnerForPaidClause. Así, si el usuario no paga o quita la
  // cláusula al final, el abogado nunca es notificado.
  return NextResponse.json({
    success: true,
    notified: 0,
    deferred: true,
    reason: emails.length === 0 ? "no_legal_partner" : "deferred_until_payment",
    token,
    status: "pending",
  });
}
