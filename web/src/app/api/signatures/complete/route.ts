import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  completeSignatureRequestSchema,
  type CompleteSignatureResponse,
} from "@/domain/contracts/api-types";
import { parseSignatureToken, isTokenExpired } from "@/domain/signatures/validateSignatureToken";
import { canBeSigned } from "@/domain/signatures/signatureStatus";
import { buildSignatureEvidence } from "@/domain/signatures/signatureEvidence";
import { SIGNING_CONSENT_TEXTS, hashConsentBlock } from "@/domain/signatures/signingConsents";
import { allRequiredSignaturesCompleted } from "@/domain/signatures/signatureRules";
import type { SignatureRecord } from "@/domain/signatures/types";
import { auditEvent } from "@/features/contracts/audit";
import { renderElectronicSignatureEvidenceAnnex } from "@/domain/contracts/annexes/renderAnnex";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";
import { persistContractPdfAsset } from "@/domain/contracts/persistContractPdfAsset";
import { contractSignedEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";

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
        signedAt,
        ipAddress,
        userAgent,
        evidenceJson: evidence,
        updatedAt: signedAt,
      },
      { merge: true },
    );
    auditEvent("signature_completed", { contractId: signature.contractId, partyType: signature.partyType });

    const signaturesSnap = await firestore
      .collection("signatures")
      .where("contractId", "==", signature.contractId)
      .where("contractVersionId", "==", signature.contractVersionId)
      .get();
    const signatures = signaturesSnap.docs.map((d) => d.data() as SignatureRecord);

    const versionRef = firestore.collection("contract_versions").doc(signature.contractVersionId);
    const contractRef = firestore.collection("contracts").doc(signature.contractId);
    const versionSnap = await versionRef.get();
    const version = versionSnap.data() as {
      contractPayload?: { hasSolidaryCoDebtor: boolean };
      versionNumber?: number;
      documentHash?: string;
    } | undefined;
    if (!version?.documentHash || version.documentHash !== signature.documentHash) {
      return NextResponse.json<CompleteSignatureResponse>(
        {
          success: false,
          errors: [{ field: "documentHash", message: "La versión contractual cambió; la firma no es válida." }],
        },
        { status: 422 },
      );
    }
    const hasCodebtor = Boolean(version?.contractPayload?.hasSolidaryCoDebtor);
    const fullySigned = allRequiredSignaturesCompleted(signatures, hasCodebtor);

    if (fullySigned) {
      await Promise.all([
        contractRef.set({ status: "signed", signedAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
        versionRef.set({ status: "signed", signedAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      ]);
      auditEvent("contract_fully_signed", {
        contractId: signature.contractId,
        contractVersionId: signature.contractVersionId,
      });

      const contractSnap = await contractRef.get();
      const contractData = contractSnap.data() as { draftId?: string; status?: string } | undefined;
      const signedTemplate = contractSignedEmail({
        contractId: signature.contractId,
        leaseProcessId: contractData?.draftId,
      });
      const uniqueEmails = Array.from(
        new Set(
          signatures
            .map((item) => item.signerEmail?.trim().toLowerCase())
            .filter((email): email is string => Boolean(email)),
        ),
      );
      const emailOutcomes = await Promise.all(
        uniqueEmails.map(async (to) => {
          const r = await sendEmail({
            to,
            subject: signedTemplate.subject,
            html: signedTemplate.html,
            text: signedTemplate.text,
            templateCode: "contractSignedEmail",
            relatedEntityType: "contract",
            relatedEntityId: signature.contractId,
          });
          return r;
        }),
      );
      const ok = (s: (typeof emailOutcomes)[number]) => s.status === "sent" || s.status === "mock";
      const anyOk = emailOutcomes.some(ok);
      const allOk = emailOutcomes.length > 0 && emailOutcomes.every(ok);
      emailOutcomes.forEach((r, i) => {
        if (ok(r)) return;
        auditEvent("contract_signed_party_email_failed", {
          contractId: signature.contractId,
          templateCode: "contractSignedEmail",
          status: r.status,
          recipientIndex: i,
        });
      });
      let partyEmailDelivery: "ok" | "partial" | "failed" | undefined;
      if (uniqueEmails.length > 0) {
        if (allOk) partyEmailDelivery = "ok";
        else if (anyOk) partyEmailDelivery = "partial";
        else partyEmailDelivery = "failed";
      }
      if (version?.documentHash) {
        const annex = renderElectronicSignatureEvidenceAnnex({
          contract: { id: signature.contractId, status: "signed" },
          contractVersion: {
            id: signature.contractVersionId,
            versionNumber: version?.versionNumber ?? 1,
            documentHash: version.documentHash,
          },
          signatures,
          leaseProcessId: contractData?.draftId ?? signature.contractId,
        });
        await firestore.collection("contract_annexes").doc(annex.id).set(annex);
        auditEvent("electronic_signature_evidence_annex_generated", {
          contractId: signature.contractId,
          contractVersionId: signature.contractVersionId,
        });
        try {
          const generatedAtPdf = new Date().toISOString();
          const pdfBytes = await renderContractPdfFromHtml({
            html: annex.htmlContent,
            contractId: signature.contractId,
            contractVersionId: signature.contractVersionId,
            versionNumber: version?.versionNumber ?? 1,
            documentHash: annex.documentHash ?? version.documentHash,
            generatedAt: generatedAtPdf,
          });
          const persisted = await persistContractPdfAsset({
            pdfBytes,
            storageObjectPath: `contracts/${signature.contractId}/annexes/${annex.id}.pdf`,
            annexFirestoreDocId: annex.id,
          });
          await firestore.collection("contract_annexes").doc(annex.id).set(
            {
              pdfUrl: persisted.pdfUrl,
              pdfStoragePath: persisted.pdfStoragePath,
              evidenceCertificatePdfGeneratedAt: generatedAtPdf,
              updatedAt: generatedAtPdf,
            },
            { merge: true },
          );
          auditEvent("electronic_signature_evidence_pdf_generated", {
            contractId: signature.contractId,
            contractVersionId: signature.contractVersionId,
          });
        } catch (pdfErr) {
          auditEvent("electronic_signature_evidence_pdf_failed", {
            contractId: signature.contractId,
            contractVersionId: signature.contractVersionId,
          });
          if (process.env.NODE_ENV !== "production") console.error("electronic_signature_evidence_pdf", pdfErr);
        }
      }
      return NextResponse.json<CompleteSignatureResponse>({
        success: true,
        signatureStatus: "signed",
        contractStatus: "signed",
        partyEmailDelivery,
      });
    }

    return NextResponse.json<CompleteSignatureResponse>({
      success: true,
      signatureStatus: "signed",
      contractStatus: "signature_in_progress",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("signatures/complete error", error);
    return NextResponse.json<CompleteSignatureResponse>(
      { success: false, errors: [{ field: "server", message: "No se pudo completar la firma." }] },
      { status: 500 },
    );
  }
}

