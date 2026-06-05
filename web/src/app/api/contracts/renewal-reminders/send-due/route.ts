import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { dueRenewalReminder, daysUntilEnd } from "@/domain/contracts/renewalReminder";
import { contractRenewalReminderEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import { sendSms } from "@/services/sms/sendSms";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";
import type { ResidentialLeaseContractInput, PersonParty } from "@/domain/contracts/types";

export const runtime = "nodejs";

/**
 * Cron: recordatorios de terminación/renovación. Recorre contratos firmados con
 * la preferencia activada y, según la regla (3 meses + 2/1 semanas antes del
 * fin), envía a arrendador y arrendatario por email y SMS. Idempotente: marca
 * `renewalRemindersSent.{r1,r2}` para no repetir. Protegido por CRON_SECRET.
 *
 * Disparo sugerido: diario (Vercel Cron / GitHub Actions / externo).
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }

    const now = new Date();
    const signed = await firestore.collection("contracts").where("status", "==", "signed").get();
    let processed = 0;

    for (const doc of signed.docs) {
      const c = doc.data() as {
        renewalReminderEnabled?: boolean;
        currentVersionId?: string;
        draftId?: string;
        renewalRemindersSent?: { r1?: string; r2?: string };
      };
      if (c.renewalReminderEnabled === false) continue; // default: activado
      if (!c.currentVersionId) continue;

      const vSnap = await firestore.collection("contract_versions").doc(c.currentVersionId).get();
      const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
      const endDate = payload?.lease?.endDate;
      if (!endDate) continue;

      const sent = { r1: Boolean(c.renewalRemindersSent?.r1), r2: Boolean(c.renewalRemindersSent?.r2) };
      const due = dueRenewalReminder(endDate, now, sent);
      if (!due) continue;

      const days = daysUntilEnd(endDate, now);
      const parties: Array<{ party?: PersonParty; role: string }> = [
        { party: payload?.landlord, role: "landlord" },
        { party: payload?.tenant, role: "tenant" },
      ];

      for (const { party } of parties) {
        if (!party) continue;
        const name = (party.fullName ?? "").trim() || "Hola";
        if (party.email) {
          const tpl = contractRenewalReminderEmail({
            recipientName: name,
            endDate,
            daysUntilEnd: days,
            contractId: doc.id,
            leaseProcessId: c.draftId,
          });
          await sendEmail({
            to: party.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            templateCode: "contractRenewalReminderEmail",
            relatedEntityType: "contract",
            relatedEntityId: doc.id,
          });
        }
        // SMS solo para clientes de pago: el cron solo procesa contratos
        // `signed`, y firmar exige Plus/demo, así que el tier gratis no llega aquí.
        if (party.phone) {
          await sendSms({
            to: party.phone,
            body: `ArriendoSeguro: tu contrato de arriendo vence el ${endDate} (~${days} días). Recuerda el preaviso de 3 meses. Decide renovación o terminación en la plataforma.`,
            templateCode: "renewalReminderSms",
            relatedEntityType: "contract",
            relatedEntityId: doc.id,
          });
        }
      }

      const stamp = now.toISOString();
      await doc.ref.set(
        { renewalRemindersSent: { ...(c.renewalRemindersSent ?? {}), [due]: stamp }, updatedAt: stamp },
        { merge: true },
      );
      await firestore.collection("contract_reminder_logs").add({
        contractId: doc.id,
        kind: "renewal",
        reminder: due,
        endDate,
        daysUntilEnd: days,
        sentAt: stamp,
        createdAt: stamp,
      });
      auditEvent("renewal_reminder_sent", { contractId: doc.id, reminder: due, daysUntilEnd: days });
      processed += 1;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    await logServerError("contracts/renewal-reminders/send-due", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudieron enviar recordatorios." }] }, { status: 500 });
  }
}
