import { NextResponse } from "next/server";
import { signatureRequestOtpSchema, type SignatureOtpResponse } from "@/domain/contracts/api-types";
import { loadSignatureForToken } from "@/domain/signatures/loadSignatureForToken";
import { canBeSigned } from "@/domain/signatures/signatureStatus";
import {
  SIGNATURE_OTP_RESEND_COOLDOWN_MS,
  SIGNATURE_OTP_TTL_MS,
  generateSixDigitOtpCode,
  hashOtpForSignature,
} from "@/domain/signatures/signatureOtp";
import { auditEvent } from "@/features/contracts/audit-server";
import { signatureOtpEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientIpFromRequest,
  tooManyRequestsJson,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rate = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.signatureOtp);
    if (!rate.ok) {
      const { body, headers } = tooManyRequestsJson(rate.retryAfterSeconds);
      return NextResponse.json<SignatureOtpResponse>(
        { success: false, errors: body.errors },
        { status: 429, headers },
      );
    }

    const parsed = signatureRequestOtpSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json<SignatureOtpResponse>(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 422 },
      );
    }

    const loaded = await loadSignatureForToken(parsed.data.token);
    if (!loaded.ok) {
      return NextResponse.json<SignatureOtpResponse>(
        { success: false, errors: [{ field: "token", message: loaded.message }] },
        { status: loaded.status },
      );
    }

    const { ref, data: signature } = loaded;
    if (!canBeSigned(signature.signatureStatus)) {
      return NextResponse.json<SignatureOtpResponse>(
        { success: false, errors: [{ field: "signature", message: "La firma no está disponible." }] },
        { status: 422 },
      );
    }

    const now = Date.now();
    const lastSent = signature.signatureOtpLastSentAt
      ? new Date(signature.signatureOtpLastSentAt).getTime()
      : 0;
    if (lastSent && now - lastSent < SIGNATURE_OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((SIGNATURE_OTP_RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
      return NextResponse.json<SignatureOtpResponse>(
        {
          success: false,
          errors: [
            {
              field: "cooldown",
              message: `Espera ${waitSec} segundos antes de solicitar otro código.`,
            },
          ],
        },
        { status: 429 },
      );
    }

    const code = generateSixDigitOtpCode();
    const otpHash = hashOtpForSignature(signature.tokenHash, code);
    const expiresAt = new Date(now + SIGNATURE_OTP_TTL_MS).toISOString();
    const sentAt = new Date().toISOString();

    const tpl = signatureOtpEmail({
      signerName: signature.signerName,
      code,
      minutesValid: Math.round(SIGNATURE_OTP_TTL_MS / 60_000),
    });
    const emailResult = await sendEmail({
      to: signature.signerEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      templateCode: "signatureOtpEmail",
      relatedEntityType: "contract",
      relatedEntityId: signature.contractId,
    });

    auditEvent(
      emailResult.status === "sent" || emailResult.status === "mock"
        ? "signature_otp_sent"
        : "signature_otp_send_failed",
      {
        contractId: signature.contractId,
        partyType: signature.partyType,
        mode: emailResult.status,
      },
    );

    if (emailResult.status !== "sent" && emailResult.status !== "mock") {
      // Aplica el mismo enfriamiento aunque falle el envío, para no martillar al proveedor;
      // no actualizamos el hash hasta que el correo salga, así un código anterior sigue válido si existía.
      await ref.set({ signatureOtpLastSentAt: sentAt, updatedAt: sentAt }, { merge: true });
      return NextResponse.json<SignatureOtpResponse>(
        {
          success: false,
          errors: [{ field: "email", message: "No se pudo enviar el código. Intenta de nuevo más tarde." }],
        },
        { status: 502 },
      );
    }

    await ref.set(
      {
        signatureOtpHash: otpHash,
        signatureOtpExpiresAt: expiresAt,
        signatureOtpVerifyAttempts: 0,
        signatureOtpLastSentAt: sentAt,
        otpVerifiedAt: null,
        otpEmailAtVerification: null,
        updatedAt: sentAt,
      },
      { merge: true },
    );

    return NextResponse.json<SignatureOtpResponse>({
      success: true,
      // Modo prueba (correo sin configurar): mostramos el código para poder
      // firmar de punta a punta sin Resend. Con correo real NO se expone.
      message:
        emailResult.status === "mock"
          ? `Modo prueba (correo no configurado): tu código de verificación es ${code}. En producción llega por correo.`
          : "Si el correo coincide con el del expediente, recibirás un código de 6 dígitos. Si no lo ves en tu bandeja de entrada en un par de minutos, revisa las carpetas de spam / correo no deseado o promociones.",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("signatures/request-otp error", error);
    return NextResponse.json<SignatureOtpResponse>(
      { success: false, errors: [{ field: "server", message: "No se pudo enviar el código." }] },
      { status: 500 },
    );
  }
}
