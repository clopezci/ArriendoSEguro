import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { buildSignatureEvidence } from "@/domain/signatures/signatureEvidence";
import { SIGNING_CONSENT_TEXTS, hashConsentBlock } from "@/domain/signatures/signingConsents";
import { canBeSigned } from "@/domain/signatures/signatureStatus";
import type { SignatureRecord } from "@/domain/signatures/types";
import { auditEvent } from "@/features/contracts/audit-server";
import { finalizeSignatureRound } from "@/features/signatures/finalizeSignatureRound";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

/**
 * Firma del ARRENDADOR (dueño) EN SESIÓN, directo en la app. El dueño ya está
 * autenticado, así que su identidad la aporta la sesión (más fuerte que un OTP por
 * correo) y NO necesita invitarse a sí mismo ni pedir código. Registra la firma de
 * su parte con la MISMA evidencia y consentimiento (Ley 527 de 1999) que la firma
 * con enlace. La invitación + OTP queda solo para inquilino/codeudor.
 */
function getClientIp(request: Request): string {
  const hdr = request.headers.get("x-forwarded-for");
  return hdr ? hdr.split(",")[0]?.trim() || "unknown" : "unknown";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { contractId?: string; contractVersionId?: string; consentAccepted?: boolean; dataConfirmationAccepted?: boolean }
      | null;
    const contractId = body?.contractId?.trim() ?? "";
    const contractVersionId = body?.contractVersionId?.trim() ?? "";
    if (!contractId || !contractVersionId) {
      return NextResponse.json({ success: false, errors: [{ field: "input", message: "Faltan datos del contrato." }] }, { status: 422 });
    }
    if (!body?.consentAccepted) {
      return NextResponse.json({ success: false, errors: [{ field: "consent", message: "Debes aceptar las declaraciones para firmar." }] }, { status: 422 });
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }

    // Autenticación: debe ser parte del contrato (misma versión).
    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!participant.ok) return participant.response;

    // Buscar la firma del ARRENDADOR de esta versión (la crea signatures/start).
    const snap = await firestore
      .collection("signatures")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .where("partyType", "==", "landlord")
      .get();
    const doc = snap.docs[0];
    if (!doc) {
      return NextResponse.json(
        { success: false, errors: [{ field: "signature", message: "Aún no hay ronda de firma. Primero activa y envía a firmar." }] },
        { status: 422 },
      );
    }
    const signature = doc.data() as SignatureRecord;

    // Seguridad: SOLO el arrendador (mismo correo que su parte) firma en sesión.
    const authEmail = (participant.user.email ?? "").trim().toLowerCase();
    if (!authEmail || authEmail !== (signature.signerEmail ?? "").trim().toLowerCase()) {
      return NextResponse.json(
        { success: false, errors: [{ field: "auth", message: "Solo el arrendador puede firmar su parte desde la app." }] },
        { status: 403 },
      );
    }

    // Ya firmó: idempotente.
    if ((signature.signatureStatus as string) === "signed") {
      const finAlready = await finalizeSignatureRound(firestore, signature);
      return NextResponse.json({
        success: true,
        signatureStatus: "signed",
        contractStatus: finAlready.ok ? finAlready.contractStatus : "signature_in_progress",
      });
    }
    if (!canBeSigned(signature.signatureStatus)) {
      return NextResponse.json({ success: false, errors: [{ field: "signatureStatus", message: "La firma no está disponible." }] }, { status: 422 });
    }

    const signedAt = new Date().toISOString();
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const evidence = buildSignatureEvidence({
      signature,
      ipAddress,
      userAgent,
      signedAt,
      method: "in_app_session",
      consentTexts: SIGNING_CONSENT_TEXTS,
      // Identidad por SESIÓN autenticada (sustituye el OTP por correo).
      reinforcement: "authenticated_session",
      otpEmail: authEmail,
      consentBlockHash: hashConsentBlock(),
    });

    await doc.ref.set(
      {
        signatureStatus: "signed",
        consentAccepted: true,
        consentAcceptedAt: signedAt,
        dataConfirmationAccepted: Boolean(body.dataConfirmationAccepted),
        signatureMethod: "in_app_session",
        signedByAuthUid: participant.user.uid,
        signedAt,
        ipAddress,
        userAgent,
        evidenceJson: evidence,
        updatedAt: signedAt,
      },
      { merge: true },
    );
    auditEvent("signature_completed", { contractId, partyType: "landlord", via: "in_app_owner" });

    const fin = await finalizeSignatureRound(firestore, signature);
    if (!fin.ok) {
      return NextResponse.json({ success: false, errors: [{ field: fin.field, message: fin.message }] }, { status: fin.status });
    }
    return NextResponse.json({
      success: true,
      signatureStatus: "signed",
      contractStatus: fin.contractStatus,
      ...(fin.partyEmailDelivery ? { partyEmailDelivery: fin.partyEmailDelivery } : {}),
    });
  } catch (error) {
    await logServerError("signatures/sign-owner", error);
    if (process.env.NODE_ENV !== "production") console.error("signatures/sign-owner error", error);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo firmar." }] }, { status: 500 });
  }
}
