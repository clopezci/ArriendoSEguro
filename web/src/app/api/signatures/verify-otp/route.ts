import { NextResponse } from "next/server";
import { signatureVerifyOtpSchema, type SignatureOtpResponse } from "@/domain/contracts/api-types";
import { loadSignatureForToken } from "@/domain/signatures/loadSignatureForToken";
import { canBeSigned } from "@/domain/signatures/signatureStatus";
import { SIGNATURE_OTP_MAX_VERIFY_ATTEMPTS, verifyOtpCode } from "@/domain/signatures/signatureOtp";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = signatureVerifyOtpSchema.safeParse(await request.json().catch(() => ({})));
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

    const hash = signature.signatureOtpHash;
    const expiresAt = signature.signatureOtpExpiresAt;
    if (!hash || !expiresAt) {
      return NextResponse.json<SignatureOtpResponse>(
        { success: false, errors: [{ field: "otp", message: "Primero solicita un código de verificación." }] },
        { status: 422 },
      );
    }
    if (new Date(expiresAt).getTime() < Date.now()) {
      return NextResponse.json<SignatureOtpResponse>(
        { success: false, errors: [{ field: "otp", message: "El código expiró. Solicita uno nuevo." }] },
        { status: 410 },
      );
    }

    const attempts = signature.signatureOtpVerifyAttempts ?? 0;
    if (attempts >= SIGNATURE_OTP_MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json<SignatureOtpResponse>(
        {
          success: false,
          errors: [
            {
              field: "otp",
              message: "Superaste el número máximo de intentos. Solicita un código nuevo.",
            },
          ],
        },
        { status: 422 },
      );
    }

    const ok = verifyOtpCode(hash, signature.tokenHash, parsed.data.code);
    const now = new Date().toISOString();

    if (!ok) {
      await ref.set(
        {
          signatureOtpVerifyAttempts: attempts + 1,
          updatedAt: now,
        },
        { merge: true },
      );
      auditEvent("signature_otp_verify_failed", {
        contractId: signature.contractId,
        partyType: signature.partyType,
        attempts: attempts + 1,
      });
      return NextResponse.json<SignatureOtpResponse>(
        { success: false, errors: [{ field: "code", message: "Código incorrecto." }] },
        { status: 422 },
      );
    }

    await ref.set(
      {
        otpVerifiedAt: now,
        otpEmailAtVerification: signature.signerEmail.trim().toLowerCase(),
        signatureOtpHash: null,
        signatureOtpExpiresAt: null,
        signatureOtpVerifyAttempts: 0,
        updatedAt: now,
      },
      { merge: true },
    );

    auditEvent("signature_otp_verified", {
      contractId: signature.contractId,
      partyType: signature.partyType,
    });

    return NextResponse.json<SignatureOtpResponse>({ success: true, message: "Código verificado correctamente." });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("signatures/verify-otp error", error);
    return NextResponse.json<SignatureOtpResponse>(
      { success: false, errors: [{ field: "server", message: "No se pudo verificar el código." }] },
      { status: 500 },
    );
  }
}
