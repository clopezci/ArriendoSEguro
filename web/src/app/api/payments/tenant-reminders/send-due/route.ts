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
import { isWhatsAppConfigured } from "@/services/whatsapp/sendWhatsApp";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
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
/** Contactos (correo + celular) de los codeudores (primario + adicionales). */
function codebtorContacts(p: VersionParties): Array<{ email: string; phone: string }> {
  const list = [p.solidaryCoDebtor, ...(p.solidaryCoDebtors ?? [])];
  return list
    .map((c) => ({ email: (c?.email ?? "").trim(), phone: (c?.phone ?? "").trim() }))
    .filter((c) => c.email || c.phone);
}

/**
 * Envía un recordatorio al CELULAR por el canal configurado:
 * PAYMENT_REMINDER_CHANNEL="whatsapp" (y WhatsApp configurado) → WhatsApp con
 * plantilla (1 variable = el mensaje); en otro caso → SMS. `msg` es el texto
 * (sin marca; el SMS le antepone "ArriendoSeguro:"). No incluye URLs largas: el
 * enlace para subir el soporte va en el CORREO.
 */
async function phoneReminder(to: string | undefined, msg: string, relatedId: string): Promise<void> {
  const useWa = (process.env.PAYMENT_REMINDER_CHANNEL || "sms").toLowerCase() === "whatsapp" && isWhatsAppConfigured();
  await sendPhoneNotice({
    to,
    message: msg,
    templateCode: useWa ? "paymentReminderWa" : "paymentReminderSms",
    relatedEntityType: "payment",
    relatedEntityId: relatedId,
    whatsapp: { enabled: useWa, templateName: process.env.WHATSAPP_TEMPLATE_PAYMENT?.trim() || "recordatorio_pago" },
  });
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
      // Mensaje al celular (WhatsApp/SMS según canal) en AMBOS hitos: antes y el
      // día del vencimiento. El enlace para subir el soporte va en el correo.
      const amount = `$${(Number(row.expectedAmount) || 0).toLocaleString("es-CO")}`;
      const payUrl = `${base}/pago/${token}`;
      const msg = milestone === "before"
        ? `faltan ${daysBefore} días para el pago de tu arriendo (${amount}). Ingresa para pagar y subir tu comprobante: ${payUrl}`
        : `hoy vence tu arriendo (${amount}). Ingresa para pagar y subir tu comprobante: ${payUrl}`;
      await phoneReminder(parties.tenant?.phone, msg, row.id ?? d.id);
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
      id?: string; contractId?: string; contractVersionId?: string; periodLabel?: string; dueDate?: string; status?: string; expectedAmount?: number;
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
    const tenantPhone = (parties.tenant?.phone ?? "").trim();
    const landlordEmail = (parties.landlord?.email ?? "").trim();
    const cods = codebtorContacts(parties);
    const spId = row.id ?? d.id;
    const per = row.periodLabel ? ` · ${row.periodLabel}` : "";
    const perP = row.periodLabel ? ` (${row.periodLabel})` : "";
    // Enlace fresco para pagar/subir el comprobante (el mensaje al celular lo lleva).
    const escLink = async () =>
      `${base}/pago/${await createUploadToken(firestore, {
        contractId: row.contractId!,
        contractVersionId: row.contractVersionId!,
        scheduledPaymentId: spId,
        periodLabel: row.periodLabel ?? "",
        dueDate: row.dueDate!,
        expectedAmount: Number(row.expectedAmount) || 0,
        landlordName: (parties.landlord?.fullName ?? "El arrendador").trim() || "El arrendador",
      })}`;

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
      // Mismo aviso al celular del inquilino (WhatsApp/SMS) CON el enlace.
      await phoneReminder(tenantPhone, `no recibimos tu comprobante de pago del arriendo${perP}. Ingresa para pagar y subir tu comprobante: ${await escLink()}. Si no lo registras, avisaremos también a tu codeudor.`, spId);
      await d.ref.set({ escLateWarnedAt: now.toISOString(), escConciliationTenantToken: cToken, escConciliationStatus: row.escConciliationStatus ?? "none" }, { merge: true });
      escalations += 1;
      continue;
    }

    // Días 2–6: recordatorio a inquilino + codeudor(es), una vez por día, por
    // correo Y al celular (WhatsApp/SMS), hasta que suba el pago.
    if (daysLate >= 2 && daysLate <= 6 && (row.escLastCodebtorDay ?? 0) < daysLate) {
      const emails = [tenantEmail, ...cods.map((c) => c.email)].filter(Boolean);
      const phones = [tenantPhone, ...cods.map((c) => c.phone)].filter(Boolean);
      for (const to of emails) {
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
      const msg = `sigue pendiente el comprobante del pago del arriendo${perP} (${daysLate} días de mora). Ingresa para pagar y subir tu comprobante: ${await escLink()}`;
      for (const ph of phones) await phoneReminder(ph, msg, spId);
      // Copia informativa al dueño: que sepa que el proceso está en curso.
      if (landlordEmail) {
        const conCod = cods.length > 0 ? " y su(s) codeudor(es)" : "";
        await sendEmail({
          to: landlordEmail,
          subject: `Aviso: arriendo en mora${per} (${daysLate} días)`,
          html: `<p>Te informamos que el pago del canon${perP} sigue <strong>sin comprobante registrado</strong> (${daysLate} días de mora).</p><p>Estamos enviando recordatorios al inquilino${conCod} para que registre el pago. Si a los 7 días de mora aún no hay comprobante, te avisaremos para que decidas registrar el <em>retraso y cobro personal</em>.</p><p>Esta es una copia informativa; no necesitas hacer nada por ahora.</p>`,
          text: `Aviso: el pago del canon${perP} sigue sin comprobante (${daysLate} días de mora). Seguimos recordándole al inquilino${conCod}. A los 7 días te avisaremos para registrar retraso y cobro personal. Copia informativa; no necesitas hacer nada por ahora.`,
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
