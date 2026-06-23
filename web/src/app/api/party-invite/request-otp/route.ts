import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import { PARTY_INVITES_COLLECTION, isInviteUsable } from "@/domain/party-invite/partyInvite";
import {
  generateSixDigitOtpCode,
  hashOtpForSignature,
  SIGNATURE_OTP_TTL_MS,
  SIGNATURE_OTP_RESEND_COOLDOWN_MS,
} from "@/domain/signatures/signatureOtp";
import { sendEmail } from "@/services/email/sendEmail";
import { signatureOtpEmail } from "@/services/email/emailTemplates";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(8) });

/** Envía un código (OTP) al correo del invitado para validar su identidad. */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.signatureOtp);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, errors: [{ field: "token", message: "Token inválido." }] }, { status: 422 });

  const invite = await getInvite(firestore, parsed.data.token);
  if (!isInviteUsable(invite, Date.now()) || !invite) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "El enlace no es válido o expiró." }] }, { status: 410 });
  }

  const last = Date.parse(invite.otpLastSentAt ?? "");
  if (Number.isFinite(last) && Date.now() - last < SIGNATURE_OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((SIGNATURE_OTP_RESEND_COOLDOWN_MS - (Date.now() - last)) / 1000);
    return NextResponse.json(
      { success: false, errors: [{ field: "cooldown", message: `Espera ${wait}s para reenviar el código.` }] },
      { status: 429 },
    );
  }

  const code = generateSixDigitOtpCode();
  const otpHash = hashOtpForSignature(invite.token, code);
  const nowIso = new Date().toISOString();
  await firestore.collection(PARTY_INVITES_COLLECTION).doc(invite.token).set(
    {
      otpHash,
      otpExpiresAt: new Date(Date.now() + SIGNATURE_OTP_TTL_MS).toISOString(),
      otpVerifyAttempts: 0,
      otpLastSentAt: nowIso,
    },
    { merge: true },
  );

  try {
    const tpl = signatureOtpEmail({
      signerName: invite.inviteeName || "Hola",
      code,
      minutesValid: Math.round(SIGNATURE_OTP_TTL_MS / 60000),
    });
    await sendEmail({
      to: invite.inviteeEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      templateCode: "signatureOtpEmail",
      relatedEntityType: "party_invite",
      relatedEntityId: invite.token,
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ success: true });
}
