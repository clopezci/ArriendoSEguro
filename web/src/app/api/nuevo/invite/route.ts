import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { createInvite } from "@/lib/party-invite/inviteStore";
import { sendEmail } from "@/services/email/sendEmail";
import { inviteCounterpartyEmail } from "@/services/email/emailTemplates";
import { appConfig } from "@/lib/config";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Genera una invitación real (token) para que el inquilino complete/suba sus
 * datos y documentos, reusando el sistema de invitaciones existente
 * (createInvite → /invitacion/{token}). A diferencia de party-invite/create,
 * SIEMPRE devuelve la URL (para poder enviarla por WhatsApp con wa.me).
 */
const schema = z
  .object({
    contractDraftId: z.string().min(1),
    method: z.enum(["whatsapp", "email"]),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    name: z.string().max(120).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.method === "email" && !d.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Indica el correo del inquilino." });
    }
    if (d.method === "whatsapp" && !(d.phone && d.phone.replace(/\D/g, "").length >= 7)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Indica el celular del inquilino." });
    }
  });

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
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }

  const invite = await createInvite(firestore, {
    contractDraftId: parsed.data.contractDraftId,
    role: "tenant",
    inviteeEmail: parsed.data.email ?? "",
    inviteeName: parsed.data.name ?? "",
    inviterUid: auth.user.uid,
    inviterEmail: auth.user.email ?? "",
    inviterName: auth.user.email || "El arrendador",
  });

  const base = appConfig.publicUrl.replace(/\/$/, "");
  const invitationUrl = `${base}/invitacion/${invite.token}`;

  let emailStatus: "sent" | "failed" | "mock" | "skipped" = "skipped";
  if (parsed.data.method === "email" && parsed.data.email) {
    try {
      const tpl = inviteCounterpartyEmail({
        inviterName: invite.inviterName,
        contractLabel: "un contrato de arrendamiento",
        invitationUrl,
      });
      const r = await sendEmail({
        to: parsed.data.email,
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

  return NextResponse.json({ success: true, invitationUrl, token: invite.token, emailStatus });
}
