import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { createUploadToken } from "@/lib/payments/uploadTokenStore";
import { PAYMENT_SETTINGS_COLLECTION, describePaymentMethodForTenant, type PaymentSettings } from "@/domain/payments/paymentSettings";
import { tenantPaymentReminderEmail, ownerConfirmEscalationEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
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
  property?: { address?: string };
  paymentSupportPolicy?: "none" | "notifications" | "notifications_and_upload";
};

/**
 * REQUERIMIENTO FORMAL DE PAGO (día 6): más contundente pero ESTRICTAMENTE LEGAL.
 * No amenaza con embargo directo (en Colombia lo decreta un juez); enuncia las
 * consecuencias LÍCITas de la mora (Ley 820/2003): terminación y restitución,
 * proceso ejecutivo —que puede conllevar embargo decretado por un juez—,
 * intereses de mora, vinculación del codeudor y reporte a centrales de riesgo
 * con la autorización ya suscrita. Devuelve el correo (constancia) y el WhatsApp
 * corto (aviso con enlace). Revisar con abogado antes de producción.
 */
function buildFormalDemand(opts: {
  tenantName: string; address: string; amount: string; daysLate: number; perP: string; payUrl: string; concUrl: string;
}): { subject: string; html: string; text: string; wa: string } {
  const { tenantName, address, amount, daysLate, perP, payUrl, concUrl } = opts;
  const subject = `REQUERIMIENTO FORMAL DE PAGO — canon en mora${perP}`;
  const html =
    `<p><strong>REQUERIMIENTO FORMAL DE PAGO</strong></p>` +
    `<p>Señor(a) ${tenantName}, a la fecha registra una mora de <strong>${daysLate} días</strong> en el pago del canon de arrendamiento del inmueble ubicado en <strong>${address}</strong>, por valor de <strong>${amount}</strong> más los intereses de mora que apliquen${perP}.</p>` +
    `<p>Le solicitamos realizar el pago en un plazo máximo de <strong>48 horas</strong>. De no hacerlo, el arrendador podrá iniciar las acciones legales previstas en el contrato y en la <strong>Ley 820 de 2003</strong>, entre ellas: la terminación del contrato y el <strong>proceso de restitución del inmueble</strong>; el <strong>proceso ejecutivo</strong> para el cobro de la deuda, que puede conllevar el <strong>embargo de bienes decretado por un juez</strong>; el cobro de intereses de mora; la <strong>vinculación del codeudor solidario</strong>; y el <strong>reporte a las centrales de riesgo</strong> conforme a la autorización de tratamiento de datos suscrita.</p>` +
    `<p>Evite llegar a esa instancia. <a href="${payUrl}">Pague y suba su comprobante aquí</a>.</p>` +
    `<p>Si está en un acuerdo de conciliación con el arrendador, regístrelo aquí: <a href="${concUrl}">estoy en conciliación</a>.</p>`;
  const text =
    `REQUERIMIENTO FORMAL DE PAGO. ${tenantName}, registra ${daysLate} días de mora en el canon del inmueble en ${address} por ${amount} más intereses${perP}. Pague en máximo 48 horas; de lo contrario el arrendador podrá iniciar acciones legales (Ley 820/2003): terminación y restitución del inmueble, proceso ejecutivo —que puede conllevar embargo de bienes decretado por un juez—, intereses, vinculación del codeudor y reporte a centrales de riesgo. Pague aquí: ${payUrl} · ¿En conciliación? ${concUrl}`;
  const wa =
    `tienes un REQUERIMIENTO FORMAL DE PAGO por la mora de tu arriendo${perP} (${amount}). Revísalo y paga aquí: ${payUrl} · ¿Estás en conciliación con el arrendador? Regístralo: ${concUrl}`;
  return { subject, html, text, wa };
}

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
 * Complemento al CELULAR (WhatsApp) del recordatorio de pago. El correo es la
 * base; esto solo sale si el interruptor maestro `NOTIFICATIONS_WHATSAPP_ENABLED`
 * está encendido. `msg` es el texto que llena la plantilla de 1 variable.
 */
async function phoneReminder(to: string | undefined, msg: string, relatedId: string): Promise<void> {
  await sendPhoneNotice({
    to,
    message: msg,
    templateCode: "paymentReminderWa",
    relatedEntityType: "payment",
    relatedEntityId: relatedId,
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
    .where("dueDate", ">=", isoDay(-60))
    .where("dueDate", "<=", isoDay(-1))
    .limit(2000)
    .get()
    .catch(() => null);
  for (const d of overdueSnap?.docs ?? []) {
    const row = d.data() as {
      id?: string; contractId?: string; contractVersionId?: string; periodLabel?: string; dueDate?: string; status?: string; expectedAmount?: number;
      escLateWarnedAt?: string; escLastCodebtorDay?: number; escConciliationStatus?: string;
      escConciliationTenantToken?: string; escFinalOwnerNoticeAt?: string; escPersonalCollectionToken?: string; escPersonalCollectionAt?: string;
      escCycleStart?: string;
    };
    if (!row.contractId || !row.contractVersionId || !row.dueDate) continue;
    if (row.status === "reported_paid" || row.status === "cancelled") continue;
    if (row.escConciliationStatus === "accepted" || row.escPersonalCollectionAt) continue;

    const parties = await loadVersionParties(firestore, row.contractVersionId, versionCache);
    if (parties.paymentSupportPolicy !== "notifications_and_upload") continue;

    // `daysLate` = mora REAL (desde el vencimiento) → se usa en los textos.
    // `cycleDay` = día del CICLO de cobro (desde el vencimiento, o desde
    // `escCycleStart` si el dueño re-habilitó los mensajes) → elige el paso.
    const daysLate = Math.floor((now.getTime() - new Date(row.dueDate).getTime()) / (1000 * 60 * 60 * 24));
    const cycleDay = row.escCycleStart
      ? Math.floor((now.getTime() - new Date(row.escCycleStart).getTime()) / (1000 * 60 * 60 * 24))
      : daysLate;
    if (cycleDay < 1) continue;
    const tenantEmail = (parties.tenant?.email ?? "").trim();
    const tenantPhone = (parties.tenant?.phone ?? "").trim();
    const landlordEmail = (parties.landlord?.email ?? "").trim();
    const landlordPhone = (parties.landlord?.phone ?? "").trim();
    const cods = codebtorContacts(parties);
    const spId = row.id ?? d.id;
    const per = row.periodLabel ? ` · ${row.periodLabel}` : "";
    const perP = row.periodLabel ? ` (${row.periodLabel})` : "";
    const address = (parties.property?.address ?? "").trim() || "el inmueble";
    const tenantName = (parties.tenant?.fullName ?? "").trim() || "Señor(a) arrendatario(a)";
    const amount = `$${(Number(row.expectedAmount) || 0).toLocaleString("es-CO")}`;
    // Copia SIEMPRE al dueño (correo + WhatsApp) en cada escalón, para que tenga
    // visibilidad y soporte de todo el proceso de cobro.
    const copyOwner = async (subject: string, html: string, text: string, wa: string) => {
      if (landlordEmail) {
        await sendEmail({ to: landlordEmail, subject, html, text, templateCode: "paymentEscalationEmail", relatedEntityType: "payment", relatedEntityId: spId });
      }
      await phoneReminder(landlordPhone, wa, spId);
    };
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

    // Día 1: aviso al inquilino (correo + WhatsApp) con enlace de conciliación,
    // + COPIA informativa al dueño (correo + WhatsApp). El codeudor NO se incluye
    // aún (entra al día 4).
    if (!row.escLateWarnedAt && tenantEmail) {
      const cToken = randomBytes(24).toString("hex");
      const concUrl = `${base}/api/payments/conciliation/request?token=${cToken}`;
      const payUrl = await escLink();
      await sendEmail({
        to: tenantEmail,
        subject: `Pago pendiente${per}`,
        html: `<p>No hemos recibido el comprobante de tu pago del canon${perP} (${amount}). <a href="${payUrl}">Págalo y sube tu comprobante aquí</a>.</p><p>Si estás en un acuerdo de conciliación con el arrendador, regístralo aquí: <a href="${concUrl}">estoy en conciliación</a>.</p>`,
        text: `No recibimos tu comprobante de pago${perP} (${amount}). Paga y sube tu comprobante: ${payUrl}. ¿En conciliación con el arrendador? ${concUrl}`,
        templateCode: "paymentEscalationEmail",
        relatedEntityType: "payment",
        relatedEntityId: spId,
      });
      await phoneReminder(tenantPhone, `no recibimos tu comprobante de pago del arriendo${perP} (${amount}). Ingresa para pagar y subir tu comprobante: ${payUrl}. ¿Estás en conciliación? Regístralo: ${concUrl}`, spId);
      await copyOwner(
        `Aviso: arriendo en mora${per}`,
        `<p>El pago del canon${perP} (${amount}) sigue <strong>sin comprobante registrado</strong> (${daysLate} día(s) de mora). Estamos notificando al inquilino. Es una copia informativa; te mantenemos al tanto.</p>`,
        `Aviso: el pago del canon${perP} (${amount}) sigue sin comprobante (${daysLate} día(s) de mora). Notificando al inquilino; te mantenemos al tanto.`,
        `arriendo en mora${perP} (${amount}), ${daysLate} día(s). Estamos notificando al inquilino; te mantenemos al tanto.`,
      );
      await d.ref.set({ escLateWarnedAt: now.toISOString(), escConciliationTenantToken: cToken, escConciliationStatus: row.escConciliationStatus ?? "none" }, { merge: true });
      escalations += 1;
      continue;
    }

    // Días 2–6: recordatorio diario (una vez por día), por correo Y WhatsApp.
    // El CODEUDOR se incluye SOLO a partir del día 4. El día 6 es el
    // REQUERIMIENTO FORMAL DE PAGO (comunicado firme y legal). Copia SIEMPRE al
    // dueño (correo + WhatsApp). El inquilino puede responder con "estoy en
    // conciliación" desde el enlace en cada mensaje.
    if (cycleDay >= 2 && cycleDay <= 6 && (row.escLastCodebtorDay ?? 0) < cycleDay) {
      const includeCodebtor = cycleDay >= 4;
      const emails = [tenantEmail, ...(includeCodebtor ? cods.map((c) => c.email) : [])].filter(Boolean);
      const phones = [tenantPhone, ...(includeCodebtor ? cods.map((c) => c.phone) : [])].filter(Boolean);
      const payUrl = await escLink();
      const concUrl = row.escConciliationTenantToken ? `${base}/api/payments/conciliation/request?token=${row.escConciliationTenantToken}` : "";
      const conCodTxt = includeCodebtor && cods.length > 0 ? " y al codeudor" : "";

      if (cycleDay >= 6) {
        // Día 6 — REQUERIMIENTO FORMAL DE PAGO (firme, legal).
        const dem = buildFormalDemand({ tenantName, address, amount, daysLate, perP, payUrl, concUrl });
        for (const to of emails) {
          await sendEmail({ to, subject: dem.subject, html: dem.html, text: dem.text, templateCode: "paymentEscalationEmail", relatedEntityType: "payment", relatedEntityId: spId });
        }
        for (const ph of phones) await phoneReminder(ph, dem.wa, spId);
        await copyOwner(
          `Requerimiento formal enviado — arriendo en mora${per} (día 6)`,
          `<p>Enviamos al inquilino${conCodTxt} un <strong>Requerimiento Formal de Pago</strong> por la mora del canon${perP} (${amount}, ${daysLate} días). Si mañana no hay pago, te avisaremos para registrar el retraso y el cobro personal.</p>`,
          `Enviamos el Requerimiento Formal de Pago al inquilino${conCodTxt} por la mora del canon${perP} (${amount}, ${daysLate} días). Si mañana no hay pago, te avisamos para el cobro personal.`,
          `enviamos el REQUERIMIENTO FORMAL de pago por la mora del arriendo${perP} (${amount}, ${daysLate} días). Si mañana no paga, te avisamos para el cobro personal.`,
        );
      } else {
        // Días 2–5 — recordatorio normal.
        const html = `<p>Sigue pendiente el comprobante del pago del canon${perP} (${amount}, ${daysLate} días de mora). <a href="${payUrl}">Págalo y sube tu comprobante aquí</a>.</p>${concUrl ? `<p>¿En conciliación con el arrendador? <a href="${concUrl}">regístralo aquí</a>.</p>` : ""}`;
        const text = `Sigue pendiente el pago del canon${perP} (${amount}, ${daysLate} días de mora). Paga aquí: ${payUrl}${concUrl ? ` · ¿En conciliación? ${concUrl}` : ""}`;
        for (const to of emails) {
          await sendEmail({ to, subject: `Recordatorio: pago del canon pendiente${per}`, html, text, templateCode: "paymentEscalationEmail", relatedEntityType: "payment", relatedEntityId: spId });
        }
        const wa = `sigue pendiente el pago del arriendo${perP} (${amount}, ${daysLate} días de mora). Ingresa para pagar y subir tu comprobante: ${payUrl}${concUrl ? ` · ¿En conciliación? ${concUrl}` : ""}`;
        for (const ph of phones) await phoneReminder(ph, wa, spId);
        await copyOwner(
          `Aviso: arriendo en mora${per} (${daysLate} días)`,
          `<p>El pago del canon${perP} (${amount}) sigue <strong>sin comprobante</strong> (${daysLate} días de mora). Seguimos recordándole al inquilino${conCodTxt}. Copia informativa; a los 6 días enviamos un requerimiento formal y al 7.º te avisamos para el cobro personal.</p>`,
          `El pago del canon${perP} (${amount}) sigue sin comprobante (${daysLate} días). Seguimos recordándole al inquilino${conCodTxt}. Copia informativa.`,
          `arriendo en mora${perP} (${amount}), ${daysLate} días. Seguimos recordándole al inquilino${conCodTxt}.`,
        );
      }
      await d.ref.set({ escLastCodebtorDay: cycleDay }, { merge: true });
      escalations += 1;
      continue;
    }

    // Día 7+: aviso al dueño para registrar retraso y cobro personal.
    if (cycleDay >= 7 && !row.escFinalOwnerNoticeAt && landlordEmail) {
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
