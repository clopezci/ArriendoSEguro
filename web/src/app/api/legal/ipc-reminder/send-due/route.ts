import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { getAdminInternalEmailSet } from "@/lib/admin/internal-admin";
import {
  LEGAL_CONFIG_COLLECTION,
  LEGAL_CONFIG_DOC_ID,
  getLegalConfig,
} from "@/domain/legal/legalConfig";
import { ipcUpdateReminderEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

/**
 * Cron: recordatorio anual para actualizar el IPC. Diseñado para correr a
 * diario; solo envía durante la **segunda semana de enero en adelante**
 * (día ≥ 8) si el admin aún NO ha confirmado/actualizado el IPC para el año en
 * curso, y como máximo una vez cada 7 días para no saturar. Protegido por
 * CRON_SECRET. El correo deja de enviarse cuando el admin confirma en `/admin`.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const now = new Date();
  const month = now.getUTCMonth(); // 0 = enero
  const day = now.getUTCDate();
  const currentYear = now.getUTCFullYear();

  // Solo a partir de la 2ª semana de enero.
  if (month !== 0 || day < 8) {
    return NextResponse.json({ success: true, skipped: "fuera de ventana (2ª semana de enero)" });
  }

  const config = await getLegalConfig(firestore);
  if (config.ipcConfirmedForYear === currentYear) {
    return NextResponse.json({ success: true, skipped: "ya confirmado este año" });
  }

  // No repetir si ya se envió en los últimos 7 días.
  if (config.ipcReminderLastSentAt) {
    const last = Date.parse(config.ipcReminderLastSentAt);
    if (Number.isFinite(last) && now.getTime() - last < 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ success: true, skipped: "enviado hace menos de 7 días" });
    }
  }

  const admins = [...getAdminInternalEmailSet()];
  if (admins.length === 0) {
    return NextResponse.json({ success: true, skipped: "sin ADMIN_INTERNAL_EMAILS configurado" });
  }

  const tpl = ipcUpdateReminderEmail({
    currentIpcPercent: config.ipcPercent,
    currentIpcYear: config.ipcPreviousYear,
    year: currentYear,
  });
  let sent = 0;
  for (const to of admins) {
    const r = await sendEmail({
      to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      templateCode: "ipcUpdateReminderEmail",
      relatedEntityType: "legal_config",
      relatedEntityId: "ipc",
    });
    if (r.status === "sent" || r.status === "mock") sent += 1;
  }

  await firestore.collection(LEGAL_CONFIG_COLLECTION).doc(LEGAL_CONFIG_DOC_ID).set(
    { ipcReminderLastSentAt: now.toISOString(), updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  auditEvent("ipc_update_reminder_sent", { year: currentYear, recipients: admins.length });

  return NextResponse.json({ success: true, sent });
}
