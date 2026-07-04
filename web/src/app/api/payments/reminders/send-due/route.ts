import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { sendPaymentReminderEmail } from "@/features/payments/sendPaymentReminderEmail";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

// Endpoint de recordatorios (legacy). Se protege con CRON_SECRET para que no sea
// un disparador abierto de correos. El cron canónico es tenant-reminders/send-due.
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const now = new Date();
    // Acotamos la lectura a la ventana de fechas relevante (próximos ~3 meses):
    // un recordatorio solo dispara cuando faltan `reminderDaysBefore` días, así
    // que su `dueDate` ("YYYY-MM-DD") cae en el futuro cercano. Usamos rango sobre
    // un único campo (auto-indexado, sin índice compuesto) y filtramos
    // `reminderEnabled`/estado dentro del bucle.
    const isoDay = (addDays: number) => {
      const x = new Date(now);
      x.setUTCDate(x.getUTCDate() + addDays);
      return x.toISOString().slice(0, 10);
    };
    const all = await firestore
      .collection("scheduled_payments")
      .where("dueDate", ">=", isoDay(-1))
      .where("dueDate", "<=", isoDay(92))
      .limit(2000)
      .get();
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
        reminderEnabled?: boolean;
        reminderDaysBefore: number;
        reminderEmailTo: string;
        reminderStatus: string;
      };
      if (row.reminderEnabled !== true) continue;
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

