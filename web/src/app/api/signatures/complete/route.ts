import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  completeSignatureRequestSchema,
  type CompleteSignatureResponse,
} from "@/domain/contracts/api-types";
import { parseSignatureToken, isTokenExpired } from "@/domain/signatures/validateSignatureToken";
import { canBeSigned } from "@/domain/signatures/signatureStatus";
import { buildSignatureEvidence } from "@/domain/signatures/signatureEvidence";
import { SIGNING_CONSENT_TEXTS, hashConsentBlock } from "@/domain/signatures/signingConsents";
import type { SignatureRecord } from "@/domain/signatures/types";
import { auditEvent } from "@/features/contracts/audit-server";
import { finalizeSignatureRound } from "@/features/signatures/finalizeSignatureRound";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

function getClientIp(request: Request): string {
  const hdr = request.headers.get("x-forwarded-for");
  if (!hdr) return "unknown";
  return hdr.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  try {
    const parsedBody = completeSignatureRequestSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json<CompleteSignatureResponse>(
        {
          success: false,
          errors: parsedBody.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 422 },
      );
    }

    const parsedToken = parseSignatureToken(parsedBody.data.token);
    if (!parsedToken) {
      return NextResponse.json<CompleteSignatureResponse>(
        { success: false, errors: [{ field: "token", message: "Token inválido." }] },
        { status: 422 },
      );
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<CompleteSignatureResponse>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const signatureRef = firestore.collection("signatures").doc(parsedToken.signatureId);
    const signatureSnap = await signatureRef.get();
    if (!signatureSnap.exists) {
      return NextResponse.json<CompleteSignatureResponse>(
        { success: false, errors: [{ field: "token", message: "Firma no encontrada." }] },
        { status: 404 },
      );
    }
    const signature = signatureSnap.data() as SignatureRecord;
    if (signature.tokenHash !== parsedToken.tokenHash) {
      return NextResponse.json<CompleteSignatureResponse>(
        { success: false, errors: [{ field: "token", message: "Token inválido." }] },
        { status: 422 },
      );
    }
    if (isTokenExpired(signature.tokenExpiresAt)) {
      await signatureRef.set({ signatureStatus: "expired", updatedAt: new Date().toISOString() }, { merge: true });
      return NextResponse.json<CompleteSignatureResponse>(
        { success: false, errors: [{ field: "token", message: "El enlace de firma expiró." }] },
        { status: 410 },
      );
    }
    if (!canBeSigned(signature.signatureStatus)) {
      return NextResponse.json<CompleteSignatureResponse>(
        { success: false, errors: [{ field: "signatureStatus", message: "La firma no está disponible." }] },
        { status: 422 },
      );
    }

    if (!signature.otpVerifiedAt) {
      return NextResponse.json<CompleteSignatureResponse>(
        {
          success: false,
          errors: [
            {
              field: "otp",
              message:
                "Primero verifica el código de seguridad de 6 dígitos que enviamos a tu correo (botón «Solicitar código» en la misma página).",
            },
          ],
        },
        { status: 422 },
      );
    }

    const signedAt = new Date().toISOString();
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const evidence = buildSignatureEvidence({
      signature,
      ipAddress,
      userAgent,
      signedAt,
      method: "email_link",
      consentTexts: SIGNING_CONSENT_TEXTS,
      otpVerifiedAt: signature.otpVerifiedAt,
      otpEmail: signature.otpEmailAtVerification ?? signature.signerEmail,
      consentBlockHash: hashConsentBlock(),
    });

    await signatureRef.set(
      {
        signatureStatus: "signed",
        consentAccepted: true,
        consentAcceptedAt: signedAt,
        // El titular confirma que sus datos son correctos (Habeas Data, Ley 1581).
        dataConfirmationAccepted: Boolean(parsedBody.data.dataConfirmationAccepted),
        signedAt,
        ipAddress,
        userAgent,
        evidenceJson: evidence,
        updatedAt: signedAt,
      },
      { merge: true },
    );
    auditEvent("signature_completed", { contractId: signature.contractId, partyType: signature.partyType });

    const fin = await finalizeSignatureRound(firestore, signature);
    if (!fin.ok) {
      return NextResponse.json<CompleteSignatureResponse>(
        { success: false, errors: [{ field: fin.field, message: fin.message }] },
        { status: fin.status },
      );
    }
    return NextResponse.json<CompleteSignatureResponse>({
      success: true,
      signatureStatus: "signed",
      contractStatus: fin.contractStatus,
      ...(fin.partyEmailDelivery ? { partyEmailDelivery: fin.partyEmailDelivery } : {}),
    });
  } catch (error) {
    await logServerError("signatures/complete", error);
    if (process.env.NODE_ENV !== "production") console.error("signatures/complete error", error);
    return NextResponse.json<CompleteSignatureResponse>(
      { success: false, errors: [{ field: "server", message: "No se pudo completar la firma." }] },
      { status: 500 },
    );
  }
}

