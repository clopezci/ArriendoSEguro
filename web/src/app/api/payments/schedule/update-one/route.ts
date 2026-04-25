import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { updateScheduledOneSchema } from "@/domain/payments/validatePaymentLog";
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
    const parsed = updateScheduledOneSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const ref = firestore.collection("scheduled_payments").doc(parsed.data.scheduledPaymentId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ success: false, errors: [{ field: "scheduledPaymentId", message: "Pago programado no existe." }] }, { status: 404 });
    const sp = snap.data() as { contractId?: string; contractVersionId?: string } | undefined;
    if (!sp?.contractId || !sp?.contractVersionId) {
      return NextResponse.json({ success: false, errors: [{ field: "scheduledPayment", message: "Registro programado inválido." }] }, { status: 422 });
    }

    const participant = await requireContractParticipant(
      request,
      firestore,
      sp.contractId,
      { kind: "by_version", contractVersionId: sp.contractVersionId },
    );
    if (!participant.ok) {
      if (participant.response.status === 403) {
        const u = await getAuthenticatedUser(request);
        await logPaymentAudit("payment_report_blocked_unauthorized", {
          reason: "not_participant",
          contractId: sp.contractId,
          action: "schedule_update_one",
          reportedByUserId: u?.uid ?? "",
          reportedByEmail: u?.email ?? "",
          ipAddress: ip ?? "",
          userAgent: userAgent ?? "",
        });
      } else if (participant.response.status === 401) {
        await logPaymentAudit("payment_report_blocked_unauthorized", {
          reason: "unauthenticated",
          contractId: sp.contractId,
          action: "schedule_update_one",
          ipAddress: ip ?? "",
          userAgent: userAgent ?? "",
        });
      }
      return participant.response;
    }

    const { scheduledPaymentId, ...rest } = parsed.data;
    await ref.set(
      { ...rest, updatedAt: new Date().toISOString(), lastEditedByUserId: participant.user.uid },
      { merge: true },
    );
    await logPaymentAudit("payment_schedule_item_updated", {
      scheduledPaymentId,
      contractId: sp.contractId,
      reportedByUserId: participant.user.uid,
      reportedByEmail: participant.user.email,
      reportedByRole: participant.role,
      ipAddress: ip ?? "",
      userAgent: userAgent ?? "",
    });
    auditEvent("payment_schedule_item_updated", { scheduledPaymentId: parsed.data.scheduledPaymentId });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo actualizar pago programado." }] }, { status: 500 });
  }
}
