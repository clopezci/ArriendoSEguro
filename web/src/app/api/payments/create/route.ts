import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  paymentCreateSchema,
  validatePaymentBusinessRules,
} from "@/domain/payments/validatePaymentLog";
import { computePaymentStatus } from "@/domain/payments/paymentStatus";
import { validatePaymentReporter } from "@/domain/payments/paymentAuthorization";
import {
  sanitizeSupportFileName,
  validatePaymentSupportFile,
} from "@/domain/payments/supportValidation";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = paymentCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 422 },
      );
    }
    const issues = validatePaymentBusinessRules({
      amountDue: parsed.data.amountDue,
      amountPaid: parsed.data.amountPaid,
    });
    if (issues.length) return NextResponse.json({ success: false, errors: issues }, { status: 422 });

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }
    const versionSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
    if (!versionSnap.exists) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractVersionId", message: "Versión no encontrada." }] },
        { status: 404 },
      );
    }
    const v = versionSnap.data() as {
      contractId?: string;
      contractPayload?: {
        landlord?: { email?: string };
        tenant?: { email?: string };
        solidaryCoDebtor?: { email?: string };
      };
    } | undefined;
    if (v?.contractId !== parsed.data.contractId) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    auditEvent("payment_report_attempted", {
      contractId: parsed.data.contractId,
      contractVersionId: parsed.data.contractVersionId,
      reportedByRole: parsed.data.reportedByRole,
      reportedByUserId: parsed.data.reportedByUserId,
    });

    const reporterValidation = validatePaymentReporter({
      contractPayload: v?.contractPayload,
      userEmail: parsed.data.reportedByEmail,
      reportedByRole: parsed.data.reportedByRole,
    });
    if (!reporterValidation.ok) {
      auditEvent("payment_report_blocked_unauthorized", {
        contractId: parsed.data.contractId,
        reportedByUserId: parsed.data.reportedByUserId,
        reportedByRole: parsed.data.reportedByRole,
      });
      return NextResponse.json({ success: false, errors: reporterValidation.errors }, { status: 403 });
    }

    const supportValidation = validatePaymentSupportFile({
      supportFileName: parsed.data.supportFileName,
      supportFileType: parsed.data.supportFileType,
      supportFileSize: parsed.data.supportFileSize,
    });
    const hasValidSupport = supportValidation.ok;
    const status = computePaymentStatus({
      dueDate: parsed.data.dueDate,
      paidDate: parsed.data.paidDate,
      amountDue: parsed.data.amountDue,
      amountPaid: parsed.data.amountPaid,
      hasValidSupport,
    });
    const effectiveStatus =
      parsed.data.amountPaid > 0 && !hasValidSupport
        ? (parsed.data.paidDate ? "pending_support" : "reported_without_support")
        : status;

    const ref = firestore.collection("payments_log").doc();
    const safeFileName = parsed.data.supportFileName
      ? sanitizeSupportFileName(parsed.data.supportFileName)
      : undefined;
    const supportFileUrl = safeFileName
      ? parsed.data.supportFileUrl ?? `mock://payment-support/${ref.id}/${safeFileName}`
      : undefined;

    await ref.set({
      id: ref.id,
      ...parsed.data,
      registeredByUserId: parsed.data.reportedByUserId,
      reportedByUserId: parsed.data.reportedByUserId,
      reportedByRole: reporterValidation.role,
      reportedAt: now,
      paymentStatus: effectiveStatus,
      supportRequired: true,
      supportValidationStatus: supportValidation.supportValidationStatus,
      supportFileName: safeFileName,
      supportFileUrl,
      supportUploadedAt: safeFileName ? now : undefined,
      createdAt: now,
      updatedAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
    });
    if (safeFileName && supportFileUrl) {
      await firestore.collection("payment_support_files").doc().set({
        id: `psf_${Date.now()}`,
        paymentLogId: ref.id,
        fileName: safeFileName,
        fileUrl: supportFileUrl,
        fileType: parsed.data.supportFileType ?? "unknown",
        fileSize: parsed.data.supportFileSize ?? 0,
        uploadedByUserId: parsed.data.reportedByUserId,
        uploadedAt: now,
      });
      auditEvent("payment_support_uploaded", {
        paymentLogId: ref.id,
        contractId: parsed.data.contractId,
      });
    }
    if (parsed.data.scheduledPaymentId) {
      const spRef = firestore.collection("scheduled_payments").doc(parsed.data.scheduledPaymentId);
      const spSnap = await spRef.get();
      if (spSnap.exists) {
        const sp = spSnap.data() as {
          status?: string;
          paymentLogId?: string;
          contractId?: string;
          contractVersionId?: string;
          dueDate?: string;
        } | undefined;
        if (sp?.contractId === parsed.data.contractId && sp?.contractVersionId === parsed.data.contractVersionId) {
          if (sp.paymentLogId && sp.paymentLogId !== ref.id && status === "reported_paid") {
            return NextResponse.json(
              {
                success: false,
                errors: [
                  {
                    field: "scheduledPaymentId",
                    message: "Este periodo ya tiene un pago principal asociado.",
                  },
                ],
              },
              { status: 422 },
            );
          }
          const scheduledStatus =
            status === "partial"
              ? "partial"
              : status === "disputed"
                ? "disputed"
                : effectiveStatus === "pending_support" || effectiveStatus === "reported_without_support"
                  ? "pending_support"
                  : status === "pending"
                  ? "pending"
                  : "reported_paid";
          await spRef.set(
            {
              paymentLogId: ref.id,
              status: scheduledStatus,
              updatedAt: now,
            },
            { merge: true },
          );
          await firestore.collection("audit_logs").add({
            event: "payment_linked_to_schedule",
            scheduledPaymentId: parsed.data.scheduledPaymentId,
            paymentLogId: ref.id,
            at: now,
          });
          auditEvent("payment_linked_to_schedule", {
            scheduledPaymentId: parsed.data.scheduledPaymentId,
            paymentLogId: ref.id,
          });
        }
      }
    }
    if (effectiveStatus === "pending_support" || effectiveStatus === "reported_without_support") {
      auditEvent("payment_reported_without_support", {
        paymentLogId: ref.id,
        contractId: parsed.data.contractId,
      });
    } else if (effectiveStatus === "reported_paid" || effectiveStatus === "late" || effectiveStatus === "partial") {
      auditEvent("payment_reported_with_support", {
        paymentLogId: ref.id,
        contractId: parsed.data.contractId,
      });
    }
    auditEvent("payment_status_changed", { paymentLogId: ref.id, from: "new", to: effectiveStatus });
    auditEvent("payment_log_created", { paymentLogId: ref.id, contractId: parsed.data.contractId });
    return NextResponse.json({
      success: true,
      paymentLogId: ref.id,
      paymentStatus: effectiveStatus,
      supportValidationErrors: supportValidation.errors,
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo crear el pago." }] },
      { status: 500 },
    );
  }
}

