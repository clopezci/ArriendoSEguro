import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { allRequiredSignaturesCompleted } from "@/domain/signatures/signatureRules";
import type { SignatureRecord } from "@/domain/signatures/types";
import { auditEvent } from "@/features/contracts/audit-server";
import { renderElectronicSignatureEvidenceAnnex } from "@/domain/contracts/annexes/renderAnnex";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";
import { persistContractPdfAsset } from "@/domain/contracts/persistContractPdfAsset";
import { contractSignedEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";

/**
 * Cierre de una ronda de firma tras registrar UNA firma: revisa si ya firmaron
 * TODAS las partes; si sí, marca el contrato como firmado, genera el anexo de
 * evidencia + su PDF y notifica a todas las partes. Compartido por la firma con
 * enlace+OTP (`signatures/complete`) y la firma en sesión del dueño
 * (`signatures/sign-owner`), para NO duplicar la lógica legal.
 */
export type FinalizeResult =
  | { ok: true; contractStatus: "signed" | "signature_in_progress"; partyEmailDelivery?: "ok" | "partial" | "failed" }
  | { ok: false; field: string; message: string; status: number };

export async function finalizeSignatureRound(
  firestore: Firestore,
  signature: Pick<SignatureRecord, "contractId" | "contractVersionId" | "documentHash">,
): Promise<FinalizeResult> {
  const signaturesSnap = await firestore
    .collection("signatures")
    .where("contractId", "==", signature.contractId)
    .where("contractVersionId", "==", signature.contractVersionId)
    .get();
  const signatures = signaturesSnap.docs.map((d) => d.data() as SignatureRecord);

  const versionRef = firestore.collection("contract_versions").doc(signature.contractVersionId);
  const contractRef = firestore.collection("contracts").doc(signature.contractId);
  const versionSnap = await versionRef.get();
  const version = versionSnap.data() as
    | { contractPayload?: { hasSolidaryCoDebtor: boolean; solidaryCoDebtors?: unknown[] }; versionNumber?: number; documentHash?: string }
    | undefined;
  if (!version?.documentHash || version.documentHash !== signature.documentHash) {
    return { ok: false, field: "documentHash", message: "La versión contractual cambió; la firma no es válida.", status: 422 };
  }

  const codebtorCount =
    version?.contractPayload?.solidaryCoDebtors?.length ?? (version?.contractPayload?.hasSolidaryCoDebtor ? 1 : 0);
  const fullySigned = allRequiredSignaturesCompleted(signatures, codebtorCount);
  if (!fullySigned) {
    return { ok: true, contractStatus: "signature_in_progress" };
  }

  const signedAt = new Date().toISOString();
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
    uniqueEmails.map((to) =>
      sendEmail({
        to,
        subject: signedTemplate.subject,
        html: signedTemplate.html,
        text: signedTemplate.text,
        templateCode: "contractSignedEmail",
        relatedEntityType: "contract",
        relatedEntityId: signature.contractId,
      }),
    ),
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

  return { ok: true, contractStatus: "signed", partyEmailDelivery };
}
