import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { createUploadToken } from "@/lib/payments/uploadTokenStore";
import { PAYMENT_SETTINGS_COLLECTION, describePaymentMethodForTenant, type PaymentSettings } from "@/domain/payments/paymentSettings";
import { tenantPaymentReminderEmail, ownerConfirmEscalationEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import { sendSms } from "@/services/sms/sendSms";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";

/** Días tras la subida del inquilino sin confirmación del dueño para escalar. */
const ESCALATION_DAYS = 3;

type Party = { email?: string; fullName?: string; phone?: string };
type VersionParties = {
  tenant?: Party;
  landlord?: Party;
  solidaryCoDebtor?: Party;
  solidaryCoDebtors?: Party[];
  paymentSupportPolicy?: "none" | "notifications" | "notifications_and_upload";
};

async function loadVersionParties(firestore: Firestore, contractVersionId: string, cache: Map<string, VersionParties>): Promise<VersionParties> {
  const hit = cache.get(contractVersionId);
  if (hit) return hit;
  const snap = await firestore.collection("contract_versions").doc(contractVersionId).get();
  const parties = ((snap.data() as { contractPayload?: VersionParties } | undefined)?.contractPayload ?? {}) as VersionParties;
  cache.set(contractVersionId, parties);
  return parties;
}

/** Correos de los codeudores (primario + adicionales), sin vacíos. */
function codebtorEmails(p: VersionParties): string[] {
  const list = [p.solidaryCoDebtor?.email, ...((p.solidaryCoDebtors ?? []).map((c) => c?.email))];
  return list.map((e) => (e ?? "").trim()).filter(Boolean);
}

/**
 * Cron: recordatorios de pago al **inquilino** a 3 días del vencimiento y el día
 * del vencimiento, con el método de pago (QR/cuenta) y el enlace mágico para
 * subir el soporte. Además **escala** a ambas partes los pagos subidos sin
 * confirmar por el dueño. Diseñado para correr 1 vez al día. Protegido por CRON_SECRET.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const now = new Date();
  const base = appConfig.publicUrl.replace(/\/$/, "");
  const versionCache = new Map<string, VersionParties>();
  let reminders = 0;
  let escalations = 0;

  // Ventana de fechas relevante. `dueDate` se guarda como "YYYY-MM-DD", así que el
  // rango lexicográfico coincide con el cronológico. Cubrimos hasta 31 días adelante
  // porque los "días de aviso" son configurables (1–30) en Pagos y recordatorios;
  // el hito exacto se filtra en el bucle.
  const isoDay = (addDays: number) => {
    const x = new Date(now);
    x.setUTCDate(x.getUTCDate() + addDays);
    return x.toISOString().slice(0, 10);
  };

  // 1) Recordatorios al inquilino: N días antes (configurable) y el día del vencimiento.
  const schedSnap = await firestore
    .collection("scheduled_payments")
    .where("dueDate", ">=", isoDay(-1))
    .where("dueDate", "<=", isoDay(31))
    .limit(2000)
    .get()
    .catch(() => null);
  for (const d of schedSnap?.docs ?? []) {
    const row = d.data() as {
      id?: string;
      contractId?: string;
      contractVersionId?: string;
      periodLabel?: string;
      dueDate?: string;
      expectedAmount?: number;
      status?: string;
      reminderEnabled?: boolean;
      reminderDaysBefore?: number;
      tenantReminder3SentAt?: string;
      tenantReminderDueSentAt?: string;
    };
    if (!row.contractId || !row.contractVersionId || !row.dueDate) continue;
    if (row.status === "reported_paid" || row.status === "cancelled") continue;
    if (row.reminderEnabled === false) continue; // el dueño desactivó los recordatorios
    const due = new Date(row.dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    // Hito "antes" con los días de aviso configurados (por defecto 3) + el día del vencimiento.
    const daysBefore = Math.min(30, Math.max(1, Number(row.reminderDaysBefore) || 3));
    const milestone = diffDays === daysBefore ? "before" : diffDays === 0 ? "due" : null;
    if (!milestone) continue;
    if (milestone === "before" && row.tenantReminder3SentAt) continue;
    if (milestone === "due" && row.tenantReminderDueSentAt) continue;

    const parties = await loadVersionParties(firestore, row.contractVersionId, versionCache);
    const tenantEmail = (parties.tenant?.email ?? "").trim();
    if (!tenantEmail) continue;

    const settingsSnap = await firestore.collection(PAYMENT_SETTINGS_COLLECTION).doc(row.contractId).get();
    const settings = settingsSnap.exists ? (settingsSnap.data() as PaymentSettings) : null;

    const token = await createUploadToken(firestore, {
      contractId: row.contractId,
      contractVersionId: row.contractVersionId,
      scheduledPaymentId: row.id ?? d.id,
      periodLabel: row.periodLabel ?? "",
      dueDate: row.dueDate,
      expectedAmount: Number(row.expectedAmount) || 0,
      landlordName: (parties.landlord?.fullName ?? "El arrendador").trim() || "El arrendador",
    });

    const tpl = tenantPaymentReminderEmail({
      periodLabel: row.periodLabel ?? "",
      dueDate: row.dueDate,
      amountText: `$${(Number(row.expectedAmount) || 0).toLocaleString("es-CO")}`,
      howToPay: describePaymentMethodForTenant(settings),
      payUrl: `${base}/pago/${token}`,
      whenLabel: milestone === "before" ? `Faltan ${daysBefore} días` : "Hoy vence",
    });
    const r = await sendEmail({
      to: tenantEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      templateCode: "tenantPaymentReminderEmail",
      relatedEntityType: "payment",
      relatedEntityId: row.id ?? d.id,
    });
    if (r.status === "sent" || r.status === "mock") {
      await d.ref.set(
        milestone === "before" ? { tenantReminder3SentAt: now.toISOString() } : { tenantReminderDueSentAt: now.toISOString() },
        { merge: true },
      );
      reminders += 1;
      // SMS SOLO el día del vencimiento (decisión de costo): un mensaje al inquilino
      // con el monto y el enlace para subir el soporte. Sin Twilio configurado → mock.
      if (milestone === "due" && parties.tenant?.phone) {
        await sendSms({
          to: parties.tenant.phone,
          body: `ArriendoSeguro: hoy vence tu arriendo (${`$${(Number(row.expectedAmount) || 0).toLocaleString("es-CO")}`}). Paga y sube tu soporte aqui: ${base}/pago/${token}`,
          templateCode: "paymentReminderSms",
          relatedEntityType: "payment",
          relatedEntityId: row.id ?? d.id,
        }).catch(() => {});
      }
    }
  }

  // 2) Escalamiento: soportes subidos sin confirmación del dueño tras N días.
  const pendingSnap = await firestore
    .collection("payments_log")
    .where("uploadedByTenantLink", "==", true)
    .where("ownerConfirmed", "==", false)
    .limit(500)
    .get()
    .catch(() => null);
  for (const d of pendingSnap?.docs ?? []) {
    const row = d.data() as {
      contractVersionId?: string;
      periodLabel?: string;
      supportUploadedAt?: string;
      escalatedAt?: string;
      ownerConfirmStatus?: string;
    };
    if (row.escalatedAt || row.ownerConfirmStatus !== "pending" || !row.contractVersionId) continue;
    const uploaded = Date.parse(row.supportUploadedAt ?? "");
    if (!Number.isFinite(uploaded) || now.getTime() - uploaded < ESCALATION_DAYS * 24 * 60 * 60 * 1000) continue;

    const parties = await loadVersionParties(firestore, row.contractVersionId, versionCache);
    const recipients = [parties.landlord?.email, parties.tenant?.email].map((e) => (e ?? "").trim()).filter(Boolean);
    if (recipients.length === 0) continue;

    const contractId = (d.data() as { contractId?: string }).contractId ?? "";
    const tpl = ownerConfirmEscalationEmail({
      periodLabel: row.periodLabel ?? "",
      reviewUrl: `${base}/dashboard/contracts/${contractId}/payments`,
    });
    for (const to of recipients) {
      await sendEmail({
        to,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateCode: "ownerConfirmEscalationEmail",
        relatedEntityType: "payment",
        relatedEntityId: d.id,
      });
    }
    await d.ref.set({ escalatedAt: now.toISOString() }, { merge: true });
    escalations += 1;
  }

  // 3) Escalamiento por NO reporte (SOLO si el dueño eligió "subir soportes"):
  //    día 1 avisa al inquilino (+ link de conciliación) · días 2–6 recuerda a
  //    inquilino y codeudor(es) · día 7 avisa al dueño para registrar retraso y
  //    cobro personal. Se detiene si el pago se reporta, la conciliación es
  //    aceptada por el dueño, o se registra el cobro personal.
  const overdueSnap = await firestore
    .collection("scheduled_payments")
    .where("dueDate", ">=", isoDay(-20))
    .where("dueDate", "<=", isoDay(-1))
    .limit(2000)
    .get()
    .catch(() => null);
  for (const d of overdueSnap?.docs ?? []) {
    const row = d.data() as {
      id?: string; contractId?: string; contractVersionId?: string; periodLabel?: string; dueDate?: string; status?: string;
      escLateWarnedAt?: string; escLastCodebtorDay?: number; escConciliationStatus?: string;
      escConciliationTenantToken?: string; escFinalOwnerNoticeAt?: string; escPersonalCollectionToken?: string; escPersonalCollectionAt?: string;
    };
    if (!row.contractId || !row.contractVersionId || !row.dueDate) continue;
    if (row.status === "reported_paid" || row.status === "cancelled") continue;
    if (row.escConciliationStatus === "accepted" || row.escPersonalCollectionAt) continue;

    const parties = await loadVersionParties(firestore, row.contractVersionId, versionCache);
    if (parties.paymentSupportPolicy !== "notifications_and_upload") continue;

    const daysLate = Math.floor((now.getTime() - new Date(row.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    if (daysLate < 1) continue;
    const tenantEmail = (parties.tenant?.email ?? "").trim();
    const landlordEmail = (parties.landlord?.email ?? "").trim();
    const cods = codebtorEmails(parties);
    const spId = row.id ?? d.id;
    const per = row.periodLabel ? ` · ${row.periodLabel}` : "";
    const perP = row.periodLabel ? ` (${row.periodLabel})` : "";

    // Día 1: aviso al inquilino con link de conciliación.
    if (!row.escLateWarnedAt && tenantEmail) {
      const cToken = randomBytes(24).toString("hex");
      const concUrl = `${base}/api/payments/conciliation/request?token=${cToken}`;
      await sendEmail({
        to: tenantEmail,
        subject: `Pago pendiente${per}`,
        html: `<p>No hemos recibido el comprobante de tu pago del canon${perP}. Súbelo pronto en la plataforma.</p><p><strong>Importante:</strong> si mañana no lo registras, empezaremos a enviar recordatorios también a tu codeudor.</p><p>Si estás en un acuerdo de conciliación con el arrendador, regístralo aquí: <a href="${concUrl}">estoy en conciliación</a>.</p>`,
        text: `No recibimos tu comprobante de pago${perP}. Si mañana no lo registras, avisaremos también a tu codeudor. ¿En conciliación con el arrendador? ${concUrl}`,
        templateCode: "paymentEscalationEmail",
        relatedEntityType: "payment",
        relatedEntityId: spId,
      });
      await d.ref.set({ escLateWarnedAt: now.toISOString(), escConciliationTenantToken: cToken, escConciliationStatus: row.escConciliationStatus ?? "none" }, { merge: true });
      escalations += 1;
      continue;
    }

    // Días 2–6: recordatorio a inquilino + codeudor(es), una vez por día.
    if (daysLate >= 2 && daysLate <= 6 && (row.escLastCodebtorDay ?? 0) < daysLate) {
      for (const to of [tenantEmail, ...cods].filter(Boolean)) {
        await sendEmail({
          to,
          subject: `Recordatorio: pago del canon pendiente${per}`,
          html: `<p>Sigue pendiente el comprobante del pago del canon${perP} (${daysLate} días de mora). Por favor regístralo en la plataforma para dejar la constancia.</p>`,
          text: `Sigue pendiente el comprobante del pago del canon${perP} (${daysLate} días de mora).`,
          templateCode: "paymentEscalationEmail",
          relatedEntityType: "payment",
          relatedEntityId: spId,
        });
      }
      await d.ref.set({ escLastCodebtorDay: daysLate }, { merge: true });
      escalations += 1;
      continue;
    }

    // Día 7+: aviso al dueño para registrar retraso y cobro personal.
    if (daysLate >= 7 && !row.escFinalOwnerNoticeAt && landlordEmail) {
      const pToken = randomBytes(24).toString("hex");
      const pcUrl = `${base}/api/payments/personal-collection?token=${pToken}`;
      await sendEmail({
        to: landlordEmail,
        subject: `Pago no reportado tras el protocolo${per}`,
        html: `<p>Se siguió el protocolo de recordatorios (al inquilino y al codeudor) y el pago${perP} sigue <strong>sin reportarse</strong>.</p><p>Registra el <strong>retraso y cobro personal</strong> para continuar el proceso por tus medios: <a href="${pcUrl}">registrar retraso y cobro personal</a>.</p>`,
        text: `El pago${perP} sigue sin reportarse tras el protocolo. Registra retraso y cobro personal: ${pcUrl}`,
        templateCode: "paymentEscalationEmail",
        relatedEntityType: "payment",
        relatedEntityId: spId,
      });
      await d.ref.set({ escFinalOwnerNoticeAt: now.toISOString(), escPersonalCollectionToken: pToken }, { merge: true });
      escalations += 1;
    }
  }

  auditEvent("tenant_payment_reminders_run", { reminders, escalations });
  return NextResponse.json({ success: true, reminders, escalations });
}
