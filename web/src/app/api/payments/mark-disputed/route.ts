import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { markDisputedSchema } from "@/domain/payments/validatePaymentLog";
import { auditEvent } from "@/features/contracts/audit";
import {
  getAuthenticatedUser,
  requestClientIp,
  requestUserAgent,
  requireContractParticipant,
} from "@/lib/auth/serverAuth";
import { logPaymentAudit } from "@/features/payments/paymentAuditLog";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = requestClientIp(request);
  const userAgent = requestUserAgent(request);
  try {
    const parsed = markDisputedSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Datos inválidos." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const payRef = firestore.collection("payments_log").doc(parsed.data.paymentLogId);
    const snap = await payRef.get();
    if (!snap.exists) return NextResponse.json({ success: false, errors: [{ field: "paymentLogId", message: "Pago no existe." }] }, { status: 404 });
    const row = snap.data() as { contractId?: string; contractVersionId?: string } | undefined;
    if (!row?.contractId || !row?.contractVersionId) {
      return NextResponse.json({ success: false, errors: [{ field: "payment", message: "Pago sin contrato asociado." }] }, { status: 422 });
    }

    const participant = await requireContractParticipant(
      request,
      firestore,
      row.contractId,
      { kind: "by_version", contractVersionId: row.contractVersionId },
    );
    if (!participant.ok) {
      if (participant.response.status === 403) {
        const u = await getAuthenticatedUser(request);
        await logPaymentAudit("payment_report_blocked_unauthorized", {
          reason: "not_participant",
          contractId: row.contractId,
          paymentLogId: parsed.data.paymentLogId,
          reportedByUserId: u?.uid ?? "",
          reportedByEmail: u?.email ?? "",
          ipAddress: ip ?? "",
          userAgent: userAgent ?? "",
        });
      } else if (participant.response.status === 401) {
        await logPaymentAudit("payment_report_blocked_unauthorized", {
          reason: "unauthenticated",
          contractId: row.contractId,
          paymentLogId: parsed.data.paymentLogId,
          ipAddress: ip ?? "",
          userAgent: userAgent ?? "",
        });
      }
      return participant.response;
    }

    const now = new Date().toISOString();
    await payRef.set(
      {
        paymentStatus: "disputed",
        notes: `${(snap.data() as { notes?: string } | undefined)?.notes ?? ""}\nDisputa: ${parsed.data.reason}`,
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
      await scheduleSnap.docs[0]?.ref.set(
        { status: "disputed", updatedAt: now },
        { merge: true },
      );
    }
    await logPaymentAudit("payment_marked_disputed", {
      paymentLogId: parsed.data.paymentLogId,
      contractId: row.contractId,
      actor: participant.user.uid,
      reportedByEmail: participant.user.email,
      reportedByRole: participant.role,
      reason: parsed.data.reason,
      ipAddress: ip ?? "",
      userAgent: userAgent ?? "",
    });
    await firestore.collection("audit_logs").add({
      event: "payment_marked_disputed",
      paymentLogId: parsed.data.paymentLogId,
      reason: parsed.data.reason,
      actor: participant.user.uid,
      at: now,
    });
    auditEvent("payment_marked_disputed", { paymentLogId: parsed.data.paymentLogId });
    await logPaymentAudit("payment_status_changed", {
      paymentLogId: parsed.data.paymentLogId,
      to: "disputed",
      reportedByUserId: participant.user.uid,
    });
    auditEvent("payment_status_changed", {
      paymentLogId: parsed.data.paymentLogId,
      to: "disputed",
    });
    return NextResponse.json({ success: true, paymentStatus: "disputed" });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo marcar disputa." }] }, { status: 500 });
  }
}
