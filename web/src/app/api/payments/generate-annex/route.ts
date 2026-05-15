import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { renderPaymentLogAnnex } from "@/domain/payments/renderPaymentLogAnnex";
import type { PaymentLog } from "@/domain/payments/types";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";
import { persistContractPdfAsset } from "@/domain/contracts/persistContractPdfAsset";
import { auditEvent } from "@/features/contracts/audit";
import {
  getAuthenticatedUser,
  requestClientIp,
  requestUserAgent,
  requireContractParticipant,
} from "@/lib/auth/serverAuth";
import { logPaymentAudit } from "@/features/payments/paymentAuditLog";

export const runtime = "nodejs";

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
});

export async function POST(request: Request) {
  const ip = requestClientIp(request);
  const userAgent = requestUserAgent(request);
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Datos inválidos." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const participant = await requireContractParticipant(
      request,
      firestore,
      parsed.data.contractId,
      { kind: "by_version", contractVersionId: parsed.data.contractVersionId },
    );
    if (!participant.ok) {
      if (participant.response.status === 403) {
        const u = await getAuthenticatedUser(request);
        await logPaymentAudit("payment_report_blocked_unauthorized", {
          reason: "not_participant",
          contractId: parsed.data.contractId,
          action: "generate_annex",
          reportedByUserId: u?.uid ?? "",
          reportedByEmail: u?.email ?? "",
          ipAddress: ip ?? "",
          userAgent: userAgent ?? "",
        });
      } else if (participant.response.status === 401) {
        await logPaymentAudit("payment_report_blocked_unauthorized", {
          reason: "unauthenticated",
          contractId: parsed.data.contractId,
          action: "generate_annex",
          ipAddress: ip ?? "",
          userAgent: userAgent ?? "",
        });
      }
      return participant.response;
    }

    const versionSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
    if (!versionSnap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "Versión no existe." }] }, { status: 404 });
    }
    const version = versionSnap.data() as {
      contractId?: string;
      versionNumber?: number;
      contractPayload?: {
        property?: { address?: string };
        landlord?: { fullName?: string };
        tenant?: { fullName?: string };
      };
    } | undefined;
    if (version?.contractId !== parsed.data.contractId) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] }, { status: 422 });
    }
    const paymentsSnap = await firestore
      .collection("payments_log")
      .where("contractId", "==", parsed.data.contractId)
      .where("contractVersionId", "==", parsed.data.contractVersionId)
      .get();
    const payments = paymentsSnap.docs.map((d) => d.data() as PaymentLog);

    const rendered = renderPaymentLogAnnex({
      contractId: parsed.data.contractId,
      contractVersionId: parsed.data.contractVersionId,
      propertyAddress: version?.contractPayload?.property?.address ?? "Sin dirección",
      landlordName: version?.contractPayload?.landlord?.fullName ?? "Arrendador",
      tenantName: version?.contractPayload?.tenant?.fullName ?? "Arrendatario",
      payments,
    });
    const now = new Date().toISOString();
    const annexId = `annex_payments_${parsed.data.contractId}_${parsed.data.contractVersionId}`;
    await firestore.collection("contract_annexes").doc(annexId).set(
      {
        id: annexId,
        contractId: parsed.data.contractId,
        contractVersionId: parsed.data.contractVersionId,
        leaseProcessId: parsed.data.contractId,
        annexType: "payment_log",
        title: "Anexo No. 3 - Registro de pagos",
        status: payments.length > 0 ? "generated" : "pending",
        htmlContent: rendered.html,
        pdfUrl: null,
        documentHash: rendered.hash,
        createdAt: now,
        updatedAt: now,
        generatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    try {
      const generatedAtPdf = new Date().toISOString();
      const pdfBytes = await renderContractPdfFromHtml({
        html: rendered.html,
        contractId: parsed.data.contractId,
        contractVersionId: parsed.data.contractVersionId,
        versionNumber: version?.versionNumber ?? 1,
        documentHash: rendered.hash,
        generatedAt: generatedAtPdf,
      });
      const persisted = await persistContractPdfAsset({
        pdfBytes,
        storageObjectPath: `contracts/${parsed.data.contractId}/annexes/${annexId}.pdf`,
        annexFirestoreDocId: annexId,
      });
      await firestore.collection("contract_annexes").doc(annexId).set(
        {
          pdfUrl: persisted.pdfUrl,
          pdfStoragePath: persisted.pdfStoragePath,
          paymentLogPdfGeneratedAt: generatedAtPdf,
          updatedAt: generatedAtPdf,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      auditEvent("payment_log_annex_pdf_generated", { contractId: parsed.data.contractId });
    } catch (pdfErr) {
      auditEvent("payment_log_annex_pdf_failed", { contractId: parsed.data.contractId });
      if (process.env.NODE_ENV !== "production") console.error("payment_log_annex_pdf", pdfErr);
    }

    await logPaymentAudit("payment_log_annex_generated", {
      contractId: parsed.data.contractId,
      contractVersionId: parsed.data.contractVersionId,
      reportedByUserId: participant.user.uid,
      reportedByEmail: participant.user.email,
      reportedByRole: participant.role,
      ipAddress: ip ?? "",
      userAgent: userAgent ?? "",
    });
    auditEvent("payment_log_annex_generated", { contractId: parsed.data.contractId });
    return NextResponse.json({ success: true, documentHash: rendered.hash });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo generar anexo de pagos." }] }, { status: 500 });
  }
}

