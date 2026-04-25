import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { sendPaymentReminderEmail } from "@/features/payments/sendPaymentReminderEmail";
import { auditEvent } from "@/features/contracts/audit";

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
      const subject = `Recordatorio de pago de arriendo - ${row.periodLabel}`;
      const message = `Hola,\n\nTe recordamos que el pago del canon de arriendo correspondiente a ${row.periodLabel} vence el día ${row.dueDate}.\n\nValor esperado: $${row.expectedAmount.toLocaleString("es-CO")}\n\nEste mensaje es un recordatorio automático generado por Arriendo Seguro. La plataforma no recauda dinero ni procesa pagos; el pago debe realizarse por el medio acordado entre las partes en el contrato.\n\nSi ya realizaste el pago, puedes cargar o compartir el soporte correspondiente según lo acordado.`;
      const send = await sendPaymentReminderEmail({
        to: row.reminderEmailTo,
        subject,
        message,
      });
      const sentAt = new Date().toISOString();
      await Promise.all([
        doc.ref.set(
          {
            reminderStatus: send.status === "sent_mock" ? "sent" : "failed",
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
          subject,
          message,
          status: send.status === "sent_mock" ? "sent" : "failed",
          providerResponse: send.providerResponse,
          sentAt,
          createdAt: sentAt,
        }),
      ]);
      auditEvent(send.status === "sent_mock" ? "payment_reminder_sent" : "payment_reminder_failed", { scheduledPaymentId: row.id });
      processed += 1;
    }
    return NextResponse.json({ success: true, processed });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudieron enviar recordatorios." }] }, { status: 500 });
  }
}

