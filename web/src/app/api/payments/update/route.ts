import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  paymentUpdateSchema,
  validatePaymentBusinessRules,
} from "@/domain/payments/validatePaymentLog";
import { computePaymentStatus } from "@/domain/payments/paymentStatus";
import {
  sanitizeSupportFileName,
  validatePaymentSupportFile,
} from "@/domain/payments/supportValidation";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = paymentUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const payRef = firestore.collection("payments_log").doc(parsed.data.paymentLogId);
    const paySnap = await payRef.get();
    if (!paySnap.exists) return NextResponse.json({ success: false, errors: [{ field: "paymentLogId", message: "Pago no existe." }] }, { status: 404 });

    const current = paySnap.data() as {
      contractId: string;
      contractVersionId: string;
      amountDue: number;
      amountPaid: number;
      dueDate: string;
      paidDate?: string;
      paymentStatus: string;
      reportedByUserId?: string;
      supportValidationStatus?: "pending" | "valid" | "invalid";
      supportFileName?: string;
      supportFileType?: string;
      supportFileSize?: number;
    };
    const contractSnap = await firestore.collection("contracts").doc(current.contractId).get();
    const contract = contractSnap.data() as { status?: string } | undefined;
    if (contract?.status === "closed" || contract?.status === "voided") {
      return NextResponse.json({ success: false, errors: [{ field: "contract", message: "No se puede editar pagos de contrato cerrado." }] }, { status: 422 });
    }

    const amountDue = parsed.data.amountDue ?? current.amountDue;
    const amountPaid = parsed.data.amountPaid ?? current.amountPaid;
    const issues = validatePaymentBusinessRules({ amountDue, amountPaid });
    if (issues.length) return NextResponse.json({ success: false, errors: issues }, { status: 422 });

    const dueDate = parsed.data.dueDate ?? current.dueDate;
    const paidDate = parsed.data.paidDate ?? current.paidDate;
    const supportValidation = validatePaymentSupportFile({
      supportFileName: parsed.data.supportFileName ?? current.supportFileName,
      supportFileType: parsed.data.supportFileType ?? current.supportFileType,
      supportFileSize: parsed.data.supportFileSize ?? current.supportFileSize,
    });
    const status = current.paymentStatus === "disputed"
      ? "disputed"
      : computePaymentStatus({
          dueDate,
          paidDate,
          amountDue,
          amountPaid,
          hasValidSupport: supportValidation.ok,
        });
    const effectiveStatus =
      amountPaid > 0 && !supportValidation.ok
        ? (paidDate ? "pending_support" : "reported_without_support")
        : status;
    const now = new Date().toISOString();
    const safeFileName = parsed.data.supportFileName
      ? sanitizeSupportFileName(parsed.data.supportFileName)
      : current.supportFileName;
    await payRef.set(
      {
        ...parsed.data,
        paymentStatus: effectiveStatus,
        supportValidationStatus: supportValidation.supportValidationStatus,
        supportFileName: safeFileName,
        supportUploadedAt: safeFileName ? now : undefined,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const scheduleSnap = await firestore
      .collection("scheduled_payments")
      .where("paymentLogId", "==", parsed.data.paymentLogId)
      .limit(1)
      .get();
    if (!scheduleSnap.empty) {
      const nextScheduleStatus =
        effectiveStatus === "partial"
          ? "partial"
          : effectiveStatus === "disputed"
            ? "disputed"
            : effectiveStatus === "pending_support" || effectiveStatus === "reported_without_support"
              ? "pending_support"
              : effectiveStatus === "pending"
              ? "pending"
              : "reported_paid";
      await scheduleSnap.docs[0]?.ref.set(
        { status: nextScheduleStatus, updatedAt: now },
        { merge: true },
      );
    }
    await firestore.collection("audit_logs").add({
      event: "payment_log_updated",
      paymentLogId: parsed.data.paymentLogId,
      at: now,
      actor: current.reportedByUserId ?? "unknown",
      changes: parsed.data,
    });
    auditEvent("payment_log_updated", { paymentLogId: parsed.data.paymentLogId });
    auditEvent("payment_status_changed", {
      paymentLogId: parsed.data.paymentLogId,
      from: current.paymentStatus,
      to: effectiveStatus,
    });
    return NextResponse.json({
      success: true,
      paymentStatus: effectiveStatus,
      supportValidationErrors: supportValidation.errors,
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo actualizar el pago." }] }, { status: 500 });
  }
}

