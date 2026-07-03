import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite, createInvite } from "@/lib/party-invite/inviteStore";
import { PARTY_INVITES_COLLECTION } from "@/domain/party-invite/partyInvite";
import { sendEmail } from "@/services/email/sendEmail";
import { inviteCounterpartyEmail } from "@/services/email/emailTemplates";
import { appConfig } from "@/lib/config";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  tenantToken: z.string().min(8),
  inviteeEmail: z.string().email(),
  inviteeName: z.string().max(120).optional(),
});

/**
 * El INQUILINO (invitado ya verificado por OTP) invita al CODEUDOR. Quien tiene
 * la relación con el codeudor es el inquilino, no el dueño; por eso puede
 * generar su enlace desde su propia invitación. El codeudor se crea a nombre del
 * MISMO contrato y con el mismo `inviterUid` (el dueño), para que el dueño lo vea
 * e importe con el flujo normal.
 */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  // El inquilino debe estar identificado (OTP verificado) para poder invitar.
  const tenantInvite = await getInvite(firestore, parsed.data.tenantToken);
  if (!tenantInvite || tenantInvite.role !== "tenant") {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "Enlace inválido." }] }, { status: 410 });
  }
  if (Date.now() > Date.parse(tenantInvite.expiresAt)) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "El enlace expiró." }] }, { status: 410 });
  }
  if (!tenantInvite.otpVerifiedAt) {
    return NextResponse.json({ success: false, errors: [{ field: "otp", message: "Valida primero tu identidad con el código." }] }, { status: 403 });
  }

  const tenantName = tenantInvite.contribution?.fullName || tenantInvite.inviteeName || "El arrendatario";

  const invite = await createInvite(firestore, {
    contractDraftId: tenantInvite.contractDraftId,
    role: "solidaryCoDebtor",
    inviteeEmail: parsed.data.inviteeEmail,
    inviteeName: parsed.data.inviteeName ?? "",
    inviterUid: tenantInvite.inviterUid, // el dueño: para que él lo importe
    inviterEmail: tenantInvite.inviterEmail,
    inviterName: tenantName, // el inquilino es quien invita
  });
  await firestore
    .collection(PARTY_INVITES_COLLECTION)
    .doc(invite.token)
    .set({ createdViaTenantToken: parsed.data.tenantToken }, { merge: true });

  try {
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const tpl = inviteCounterpartyEmail({
      inviterName: tenantName,
      contractLabel: "un contrato de arrendamiento (como codeudor solidario)",
      invitationUrl: `${base}/invitacion/${invite.token}`,
    });
    await sendEmail({
      to: invite.inviteeEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      templateCode: "inviteCounterpartyEmail",
      relatedEntityType: "party_invite",
      relatedEntityId: invite.token,
    });
  } catch {
    /* el correo es best-effort; la invitación queda creada igual */
  }

  return NextResponse.json({ success: true, status: invite.status });
}
