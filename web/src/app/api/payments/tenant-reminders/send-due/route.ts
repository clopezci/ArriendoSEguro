import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { createUploadToken } from "@/lib/payments/uploadTokenStore";
import { PAYMENT_SETTINGS_COLLECTION, describePaymentMethodForTenant, type PaymentSettings } from "@/domain/payments/paymentSettings";
import { tenantPaymentReminderEmail, ownerConfirmEscalationEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";

/** Días tras la subida del inquilino sin confirmación del dueño para escalar. */
const ESCALATION_DAYS = 3;

type VersionParties = { tenant?: { email?: string; fullName?: string }; landlord?: { email?: string; fullName?: string } };

async function loadVersionParties(firestore: Firestore, contractVersionId: string, cache: Map<string, VersionParties>): Promise<VersionParties> {
  const hit = cache.get(contractVersionId);
  if (hit) return hit;
  const snap = await firestore.collection("contract_versions").doc(contractVersionId).get();
  const parties = ((snap.data() as { contractPayload?: VersionParties } | undefined)?.contractPayload ?? {}) as VersionParties;
  cache.set(contractVersionId, parties);
  return parties;
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

  // Ventana de fechas relevante para los hitos (3 días antes y el día del
  // vencimiento). `dueDate` se guarda como "YYYY-MM-DD", así que el rango
  // lexicográfico coincide con el cronológico. Acotamos a [-1, +4] días para
  // cubrir bordes de zona horaria; el filtro exacto del hito sigue en el bucle.
  const isoDay = (addDays: number) => {
    const x = new Date(now);
    x.setUTCDate(x.getUTCDate() + addDays);
    return x.toISOString().slice(0, 10);
  };

  // 1) Recordatorios al inquilino (3 días antes y el día del vencimiento).
  const schedSnap = await firestore
    .collection("scheduled_payments")
    .where("dueDate", ">=", isoDay(-1))
    .where("dueDate", "<=", isoDay(4))
    .limit(1000)
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
      tenantReminder3SentAt?: string;
      tenantReminderDueSentAt?: string;
    };
    if (!row.contractId || !row.contractVersionId || !row.dueDate) continue;
    if (row.status === "reported_paid" || row.status === "cancelled") continue;
    const due = new Date(row.dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const milestone = diffDays === 3 ? "3days" : diffDays === 0 ? "due" : null;
    if (!milestone) continue;
    if (milestone === "3days" && row.tenantReminder3SentAt) continue;
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
      whenLabel: milestone === "3days" ? "Faltan 3 días" : "Hoy vence",
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
        milestone === "3days" ? { tenantReminder3SentAt: now.toISOString() } : { tenantReminderDueSentAt: now.toISOString() },
        { merge: true },
      );
      reminders += 1;
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

  auditEvent("tenant_payment_reminders_run", { reminders, escalations });
  return NextResponse.json({ success: true, reminders, escalations });
}
