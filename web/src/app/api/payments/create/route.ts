import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  bodyContainsIgnoredIdentityFields,
  getAuthenticatedUser,
  requestClientIp,
  requestUserAgent,
  requireContractParticipant,
} from "@/lib/auth/serverAuth";
import {
  paymentCreateSchema,
  validatePaymentBusinessRules,
} from "@/domain/payments/validatePaymentLog";
import { computePaymentStatus } from "@/domain/payments/paymentStatus";
import {
  sanitizeSupportFileName,
  validatePaymentSupportFile,
} from "@/domain/payments/supportValidation";
import { auditEvent } from "@/features/contracts/audit-server";
import { logPaymentAudit } from "@/features/payments/paymentAuditLog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = requestClientIp(request);
  const userAgent = requestUserAgent(request);

  try {
    const rawText = await request.text();
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawText) as unknown;
    } catch {
      return NextResponse.json(
        { success: false, errors: [{ field: "json", message: "JSON inválido." }] },
        { status: 422 },
      );
    }
    const parsed = paymentCreateSchema.safeParse(rawJson);
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

    const participant = await requireContractParticipant(
      request,
      firestore,
      parsed.data.contractId,
      { kind: "by_version", contractVersionId: parsed.data.contractVersionId },
    );
    if (!participant.ok) {
      const st = participant.response.status;
      if (st === 403) {
        const u = await getAuthenticatedUser(request);
        await logPaymentAudit("payment_report_blocked_unauthorized", {
          reason: "not_participant",
          contractId: parsed.data.contractId,
          reportedByUserId: u?.uid ?? "",
          reportedByEmail: u?.email ?? "",
          ipAddress: ip ?? "",
          userAgent: userAgent ?? "",
        });
      } else if (st === 401) {
        await logPaymentAudit("payment_report_blocked_unauthorized", {
          reason: "unauthenticated",
          contractId: parsed.data.contractId,
          ipAddress: ip ?? "",
          userAgent: userAgent ?? "",
        });
      }
      return participant.response;
    }

    if (bodyContainsIgnoredIdentityFields(rawJson)) {
      await logPaymentAudit("payment_identity_body_ignored", {
        contractId: parsed.data.contractId,
        contractVersionId: parsed.data.contractVersionId,
        reportedByUserId: participant.user.uid,
        reportedByEmail: participant.user.email,
        ipAddress: ip ?? "",
        userAgent: userAgent ?? "",
      });
      auditEvent("payment_identity_body_ignored", { contractId: parsed.data.contractId });
    }

    const supportValidation = validatePaymentSupportFile({
      supportFileName: parsed.data.supportFileName,
      supportFileType: parsed.data.supportFileType,
      supportFileSize: parsed.data.supportFileSize,
    });
    if (!supportValidation.isEmpty && !supportValidation.ok) {
      await logPaymentAudit("payment_support_validation_failed", {
        contractId: parsed.data.contractId,
        contractVersionId: parsed.data.contractVersionId,
        reportedByUserId: participant.user.uid,
        reportedByEmail: participant.user.email,
        reportedByRole: participant.role,
        ipAddress: ip ?? "",
        userAgent: userAgent ?? "",
        errors: JSON.stringify(supportValidation.errors),
      });
      auditEvent("payment_support_validation_failed", { contractId: parsed.data.contractId });
      return NextResponse.json({ success: false, errors: supportValidation.errors }, { status: 422 });
    }
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

    const now = new Date().toISOString();
    await logPaymentAudit("payment_report_attempted", {
      contractId: parsed.data.contractId,
      contractVersionId: parsed.data.contractVersionId,
      reportedByUserId: participant.user.uid,
      reportedByEmail: participant.user.email,
      reportedByRole: participant.role,
      ipAddress: ip ?? "",
      userAgent: userAgent ?? "",
    });
    auditEvent("payment_report_attempted", { contractId: parsed.data.contractId });

    const ref = firestore.collection("payments_log").doc();
    const safeFileName = parsed.data.supportFileName
      ? sanitizeSupportFileName(parsed.data.supportFileName)
      : undefined;
    const supportFileUrl = safeFileName
      ? parsed.data.supportFileUrl ?? `mock://payment-support/${ref.id}/${safeFileName}`
      : undefined;

    const row = {
      id: ref.id,
      ...parsed.data,
      registeredByUserId: participant.user.uid,
      reportedByUserId: participant.user.uid,
      reportedByEmail: participant.user.email,
      reportedByRole: participant.role,
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
    };
    await ref.set(row);
    if (safeFileName && supportFileUrl) {
      await firestore.collection("payment_support_files").doc().set({
        id: `psf_${Date.now()}`,
        paymentLogId: ref.id,
        fileName: safeFileName,
        fileUrl: supportFileUrl,
        fileType: parsed.data.supportFileType ?? "unknown",
        fileSize: parsed.data.supportFileSize ?? 0,
        uploadedByUserId: participant.user.uid,
        uploadedAt: now,
      });
      await logPaymentAudit("payment_support_uploaded", {
        paymentLogId: ref.id,
        contractId: parsed.data.contractId,
        reportedByUserId: participant.user.uid,
        reportedByEmail: participant.user.email,
        reportedByRole: participant.role,
        ipAddress: ip ?? "",
        userAgent: userAgent ?? "",
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
        } | undefined;
        if (sp?.contractId === parsed.data.contractId && sp?.contractVersionId === parsed.data.contractVersionId) {
          if (sp.paymentLogId && sp.paymentLogId !== ref.id && effectiveStatus === "reported_paid") {
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
          await logPaymentAudit("payment_linked_to_schedule", {
            scheduledPaymentId: parsed.data.scheduledPaymentId,
            paymentLogId: ref.id,
            at: now,
            reportedByUserId: participant.user.uid,
            ipAddress: ip ?? "",
            userAgent: userAgent ?? "",
          });
          auditEvent("payment_linked_to_schedule", {
            scheduledPaymentId: parsed.data.scheduledPaymentId,
            paymentLogId: ref.id,
          });
        }
      }
    }
    if (effectiveStatus === "pending_support" || effectiveStatus === "reported_without_support") {
      await logPaymentAudit("payment_reported_without_support", {
        paymentLogId: ref.id,
        contractId: parsed.data.contractId,
        reportedByUserId: participant.user.uid,
        reportedByEmail: participant.user.email,
        reportedByRole: participant.role,
        ipAddress: ip ?? "",
        userAgent: userAgent ?? "",
      });
      auditEvent("payment_reported_without_support", {
        paymentLogId: ref.id,
        contractId: parsed.data.contractId,
      });
    } else if (effectiveStatus === "reported_paid" || effectiveStatus === "late" || effectiveStatus === "partial") {
      await logPaymentAudit("payment_reported_with_support", {
        paymentLogId: ref.id,
        contractId: parsed.data.contractId,
        reportedByUserId: participant.user.uid,
        reportedByEmail: participant.user.email,
        reportedByRole: participant.role,
        ipAddress: ip ?? "",
        userAgent: userAgent ?? "",
      });
      auditEvent("payment_reported_with_support", {
        paymentLogId: ref.id,
        contractId: parsed.data.contractId,
      });
    }
    await logPaymentAudit("payment_status_changed", {
      paymentLogId: ref.id,
      from: "new",
      to: effectiveStatus,
      reportedByUserId: participant.user.uid,
    });
    auditEvent("payment_status_changed", { paymentLogId: ref.id, from: "new", to: effectiveStatus });
    auditEvent("payment_log_created", { paymentLogId: ref.id, contractId: parsed.data.contractId });
    return NextResponse.json({
      success: true,
      paymentLogId: ref.id,
      paymentStatus: effectiveStatus,
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo crear el pago." }] },
      { status: 500 },
    );
  }
}
