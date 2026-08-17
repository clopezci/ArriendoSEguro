import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { sendEmail } from "@/services/email/sendEmail";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";
import { appConfig } from "@/lib/config";
import { deliveryActReminderEmail } from "@/services/email/emailTemplates";
import type { ResidentialLeaseContractInput, PersonParty } from "@/domain/contracts/types";

export const runtime = "nodejs";

/** Días (con signo) entre ahora y el fin del contrato: >0 falta, <0 ya pasó. */
function rawDaysUntil(endDateIso: string, now: Date): number {
  const s = endDateIso.length === 10 ? `${endDateIso}T00:00:00.000Z` : endDateIso;
  const end = new Date(s).getTime();
  if (!Number.isFinite(end)) return NaN;
  return Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Cron: recordatorio del ACTA DE ENTREGA Y DEVOLUCIÓN. En la última semana antes
 * del fin del contrato (y hasta ~2 semanas después, por si la entrega se corre),
 * avisa a inquilino y dueño que hagan el acta de devolución con fotos. Idempotente
 * (2 avisos: d1 ~7 días, d2 ~2 días). Se detiene si ya existe el acta final.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const now = new Date();
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const signed = await firestore.collection("contracts").where("status", "==", "signed").limit(5000).get();
    let processed = 0;

    for (const doc of signed.docs) {
      const c = doc.data() as {
        currentVersionId?: string;
        draftId?: string;
        deliveryActReminderEnabled?: boolean;
        deliveryActRemindersSent?: { d1?: string; d2?: string };
      };
      if (c.deliveryActReminderEnabled === false) continue;
      if (!c.currentVersionId) continue;
      const sent = c.deliveryActRemindersSent ?? {};
      if (sent.d1 && sent.d2) continue;

      const vSnap = await firestore.collection("contract_versions").doc(c.currentVersionId).get();
      const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
      const endDate = payload?.lease?.endDate;
      if (!endDate) continue;
      const days = rawDaysUntil(endDate, now);
      if (!Number.isFinite(days)) continue;
      // Ventana: desde 7 días antes del fin hasta 14 días después.
      if (days > 7 || days < -14) continue;

      // Si ya existe el acta de entrega FINAL, no molestar.
      const finalActSnap = await firestore
        .collection("contract_annexes")
        .where("contractId", "==", doc.id)
        .where("annexType", "==", "final_delivery_act")
        .limit(1)
        .get()
        .catch(() => null);
      if (finalActSnap && !finalActSnap.empty) continue;

      // ¿Qué aviso toca? d1 la primera vez en ventana; d2 cuando faltan <=2 días.
      let which: "d1" | "d2" | null = null;
      if (!sent.d1) which = "d1";
      else if (!sent.d2 && days <= 2) which = "d2";
      if (!which) continue;

      const dashId = c.draftId ?? doc.id;
      const ownerLink = `${base}/nuevo/gestionar/${dashId}/inventario?kind=final`;
      const parties: Array<{ party?: PersonParty }> = [{ party: payload?.landlord }, { party: payload?.tenant }];
      const cuando = days >= 0 ? `en ~${days} día(s)` : `hace ${Math.abs(days)} día(s)`;

      for (const { party } of parties) {
        if (!party) continue;
        const name = (party.fullName ?? "").trim() || "Hola";
        if (party.email) {
          const tpl = deliveryActReminderEmail({ recipientName: name, endDate, ownerLink });
          await sendEmail({
            to: party.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            templateCode: "deliveryActReminderEmail",
            relatedEntityType: "contract",
            relatedEntityId: doc.id,
          });
        }
        await sendPhoneNotice({
          to: party.phone,
          message: `El arriendo termina el ${endDate} (${cuando}). Hagan el ACTA DE ENTREGA Y DEVOLUCIÓN del inmueble con fotos, es su prueba del estado al devolverlo. El dueño puede iniciarla aquí: ${ownerLink}`,
          templateCode: "deliveryActReminderWa",
          relatedEntityType: "contract",
          relatedEntityId: doc.id,
        });
      }

      const stamp = now.toISOString();
      await doc.ref.set({ deliveryActRemindersSent: { ...sent, [which]: stamp }, updatedAt: stamp }, { merge: true });
      auditEvent("delivery_act_reminder_sent", { contractId: doc.id, which, days });
      processed += 1;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    await logServerError("contracts/delivery-act-reminders/send-due", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudieron enviar recordatorios de acta." }] }, { status: 500 });
  }
}
