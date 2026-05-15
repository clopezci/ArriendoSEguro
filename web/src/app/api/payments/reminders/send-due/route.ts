import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { sendPaymentReminderEmail } from "@/features/payments/sendPaymentReminderEmail";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const now = new Date();
    const all = await firestore.collection("scheduled_payments").where("reminderEnabled", "==", true).get();
    let processed = 0;
    for (const doc of all.docs) {
      const row = doc.data() as {
        id: string;
        contractId: string;
        leaseProcessId: string;
        periodLabel: string;
        dueDate: string;
        expectedAmount: number;
        status: string;
        reminderDaysBefore: number;
        reminderEmailTo: string;
        reminderStatus: string;
      };
      if (row.status === "reported_paid" || row.status === "cancelled") continue;
      if (row.reminderStatus === "disabled") continue;
      const due = new Date(row.dueDate);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays !== row.reminderDaysBefore) continue;
      const send = await sendPaymentReminderEmail({
        to: row.reminderEmailTo,
        periodLabel: row.periodLabel,
        dueDate: row.dueDate,
        expectedAmount: row.expectedAmount,
        relatedEntityId: row.id,
      });
      const sentAt = new Date().toISOString();
      await Promise.all([
        doc.ref.set(
          {
            reminderStatus: send.status === "sent" || send.status === "mock" ? "sent" : "failed",
            reminderLastSentAt: sentAt,
            updatedAt: sentAt,
          },
          { merge: true },
        ),
        firestore.collection("payment_reminder_logs").add({
          scheduledPaymentId: row.id,
          leaseProcessId: row.leaseProcessId,
          contractId: row.contractId,
          sentTo: row.reminderEmailTo,
          copiedTo: "",
          subject: `Recordatorio de pago de arriendo - ${row.periodLabel}`,
          message: `Recordatorio automático de pago para ${row.periodLabel}`,
          status: send.status === "sent" || send.status === "mock" ? "sent" : "failed",
          providerResponse: send.providerResponse,
          sentAt,
          createdAt: sentAt,
        }),
      ]);
      auditEvent(send.status === "sent" || send.status === "mock" ? "payment_reminder_sent" : "payment_reminder_failed", {
        scheduledPaymentId: row.id,
        status: send.status,
      });
      processed += 1;
    }
    return NextResponse.json({ success: true, processed });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudieron enviar recordatorios." }] }, { status: 500 });
  }
}

