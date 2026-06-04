import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { appConfig } from "@/lib/config";
import { sanitizeFreeText } from "@/lib/text/sanitize";
import { auditEvent } from "@/features/contracts/audit-server";
import { sendEmail } from "@/services/email/sendEmail";
import { partnerLeadEmail, partnerLeadAckEmail } from "@/services/email/emailTemplates";
import {
  PARTNERS_COLLECTION,
  PARTNER_LEADS_COLLECTION,
  PARTNER_CATEGORY_LABELS,
  type PartnerCategory,
} from "@/domain/partners/partners";

export const runtime = "nodejs";

const schema = z.object({
  partnerId: z.string().min(1),
  name: z.string().min(2).max(120),
  phone: z.string().min(5).max(40),
  message: z.string().max(1000).optional(),
});

function token(): string {
  return randomBytes(24).toString("hex");
}

function confirmUrl(base: string, t: string, outcome: "taken" | "not_taken"): string {
  return `${base}/api/partners/lead/confirm?token=${t}&outcome=${outcome}`;
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  const partnerSnap = await firestore.collection(PARTNERS_COLLECTION).doc(parsed.data.partnerId).get();
  if (!partnerSnap.exists || !(partnerSnap.data() as { active?: boolean }).active) {
    return NextResponse.json({ success: false, errors: [{ field: "partnerId", message: "Aliado no disponible." }] }, { status: 404 });
  }
  const partner = partnerSnap.data() as { name?: string; category?: PartnerCategory; contactEmails?: string[] };
  const contactEmails = (partner.contactEmails ?? []).filter(Boolean);
  if (contactEmails.length === 0) {
    return NextResponse.json({ success: false, errors: [{ field: "partner", message: "El aliado no tiene correo configurado." }] }, { status: 422 });
  }

  const serviceLabel = PARTNER_CATEGORY_LABELS[(partner.category ?? "otro") as PartnerCategory] ?? "un servicio";
  const partnerToken = token();
  const userToken = token();
  const now = new Date().toISOString();
  const message = parsed.data.message ? sanitizeFreeText(parsed.data.message) : "(sin mensaje)";
  const clientName = sanitizeFreeText(parsed.data.name);
  const clientPhone = sanitizeFreeText(parsed.data.phone);

  const leadRef = firestore.collection(PARTNER_LEADS_COLLECTION).doc();
  await leadRef.set({
    id: leadRef.id,
    partnerId: parsed.data.partnerId,
    partnerName: partner.name ?? "",
    category: partner.category ?? "otro",
    userUid: auth.user.uid,
    userEmail: auth.user.email,
    clientName,
    clientPhone,
    message,
    status: "sent",
    partnerResponse: null,
    userResponse: null,
    partnerToken,
    userToken,
    sentAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
    // Evidencia anti-fraude: dejamos registro del envío con su fecha.
    sentToCount: contactEmails.length,
  });

  const base = appConfig.publicUrl.replace(/\/$/, "");

  // Correo al aliado (a sus correos ocultos) con los datos del cliente.
  const partnerTpl = partnerLeadEmail({
    partnerName: partner.name ?? "Aliado",
    clientName,
    clientEmail: auth.user.email,
    clientPhone,
    serviceLabel,
    message,
    takenUrl: confirmUrl(base, partnerToken, "taken"),
    notTakenUrl: confirmUrl(base, partnerToken, "not_taken"),
  });
  let deliveredToPartner = 0;
  for (const to of contactEmails) {
    const r = await sendEmail({
      to,
      subject: partnerTpl.subject,
      html: partnerTpl.html,
      text: partnerTpl.text,
      templateCode: "partnerLeadEmail",
      relatedEntityType: "partner_lead",
      relatedEntityId: leadRef.id,
    });
    if (r.status === "sent" || r.status === "mock") deliveredToPartner += 1;
  }

  // Acuse al usuario con sus propios enlaces de confirmación.
  const ackTpl = partnerLeadAckEmail({
    clientName,
    partnerName: partner.name ?? "el aliado",
    serviceLabel,
    takenUrl: confirmUrl(base, userToken, "taken"),
    notTakenUrl: confirmUrl(base, userToken, "not_taken"),
  });
  await sendEmail({
    to: auth.user.email,
    subject: ackTpl.subject,
    html: ackTpl.html,
    text: ackTpl.text,
    templateCode: "partnerLeadAckEmail",
    relatedEntityType: "partner_lead",
    relatedEntityId: leadRef.id,
  });

  auditEvent("partner_lead_created", { partnerId: parsed.data.partnerId, deliveredToPartner });
  return NextResponse.json({ success: true, leadId: leadRef.id });
}
