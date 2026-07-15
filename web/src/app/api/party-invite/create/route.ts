import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { createInvite } from "@/lib/party-invite/inviteStore";
import { isPartyRole } from "@/domain/party-invite/partyInvite";
import { sendEmail } from "@/services/email/sendEmail";
import { inviteCounterpartyEmail } from "@/services/email/emailTemplates";
import { appConfig } from "@/lib/config";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  contractDraftId: z.string().min(1),
  role: z.string(),
  // El correo es OPCIONAL: si el dueño envía por WhatsApp puede no tenerlo. En
  // ese caso la persona ingresa su correo al abrir el enlace (para el código).
  inviteeEmail: z.string().email().or(z.literal("")).optional(),
  inviteeName: z.string().max(120).optional(),
  inviterName: z.string().max(120).optional(),
  monthlyRent: z.number().int().nonnegative().optional(),
  codebtorSlot: z.number().int().min(0).max(9).optional(),
  assignNewSlot: z.boolean().optional(),
  requiredDocs: z.array(z.string().max(60)).max(30).optional(),
  codebtorRequiredDocs: z.array(z.string().max(60)).max(30).optional(),
});

/** El dueño invita a un tercero (inquilino/codeudor) a llenar sus datos por enlace. */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.signatureOtp);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }

  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPartyRole(parsed.data.role)) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  const invite = await createInvite(firestore, {
    contractDraftId: parsed.data.contractDraftId,
    role: parsed.data.role,
    inviteeEmail: parsed.data.inviteeEmail ?? "",
    inviteeName: parsed.data.inviteeName ?? "",
    inviterUid: auth.user.uid,
    inviterEmail: auth.user.email ?? "",
    inviterName: parsed.data.inviterName?.trim() || auth.user.email || "El arrendador",
    monthlyRent: parsed.data.monthlyRent,
    codebtorSlot: parsed.data.codebtorSlot,
    assignNewSlot: parsed.data.assignNewSlot,
    requiredDocs: parsed.data.requiredDocs,
    codebtorRequiredDocs: parsed.data.codebtorRequiredDocs,
  });

  const base = appConfig.publicUrl.replace(/\/$/, "");
  const invitationUrl = `${base}/invitacion/${invite.token}`;
  let emailStatus: "sent" | "failed" | "mock" | "skipped" = "skipped";
  // Solo enviamos correo si hay correo (por WhatsApp puede no haberlo; la persona
  // lo ingresará al abrir el enlace para recibir el código).
  if (invite.inviteeEmail) {
    try {
      const tpl = inviteCounterpartyEmail({
        inviterName: invite.inviterName,
        contractLabel: "un contrato de arrendamiento",
        invitationUrl,
      });
      const r = await sendEmail({
        to: invite.inviteeEmail,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateCode: "inviteCounterpartyEmail",
        relatedEntityType: "party_invite",
        relatedEntityId: invite.token,
      });
      emailStatus = r.status;
    } catch {
      emailStatus = "failed";
    }
  }

  // Devolvemos SIEMPRE el enlace: el dueño está autenticado y es su propio
  // contrato, así puede además compartirlo por WhatsApp (elige el medio), no
  // solo por correo. El correo sigue llevando el código de verificación (OTP).
  return NextResponse.json({
    success: true,
    status: invite.status,
    emailStatus,
    invitationUrl,
    codebtorSlot: invite.codebtorSlot ?? 0,
  });
}
