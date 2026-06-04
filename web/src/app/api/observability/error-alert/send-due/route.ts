import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { getAdminInternalEmailSet } from "@/lib/admin/internal-admin";
import { ERROR_EVENTS_COLLECTION } from "@/lib/observability/observability";
import {
  OBSERVABILITY_CONFIG_COLLECTION,
  OBSERVABILITY_CONFIG_DOC_ID,
  resolveObservabilityConfig,
  shouldSendErrorAlert,
} from "@/domain/observability/observabilityConfig";
import { errorAlertEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";

export const runtime = "nodejs";

/**
 * Cron: avisa por correo a los administradores cuando hay errores recientes sin
 * resolver por encima del umbral (mínimo 1). Diseñado para correr cada pocos
 * minutos; respeta el "cooldown" para no saturar. Protegido por CRON_SECRET.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const cfgSnap = await firestore
    .collection(OBSERVABILITY_CONFIG_COLLECTION)
    .doc(OBSERVABILITY_CONFIG_DOC_ID)
    .get();
  const config = resolveObservabilityConfig(cfgSnap.exists ? cfgSnap.data() : undefined);

  const now = new Date();
  const windowStart = now.getTime() - config.errorAlertWindowMinutes * 60_000;

  // Errores activos recientes (últimas ~200 huellas por recencia).
  const snap = await firestore
    .collection(ERROR_EVENTS_COLLECTION)
    .orderBy("lastSeenServer", "desc")
    .limit(200)
    .get()
    .catch(() => null);

  const recent = (snap?.docs ?? [])
    .map((d) => d.data() as Record<string, unknown>)
    .filter((e) => {
      if (e.resolved) return false;
      const last = Date.parse(String(e.lastSeenAt ?? ""));
      return Number.isFinite(last) && last >= windowStart;
    });

  const distinctErrors = recent.length;
  const totalOccurrences = recent.reduce((sum, e) => sum + Number(e.count ?? 0), 0);

  const decision = shouldSendErrorAlert(config, distinctErrors, now.getTime());
  if (!decision.send) {
    return NextResponse.json({ success: true, skipped: decision.reason, distinctErrors });
  }

  const admins = [...getAdminInternalEmailSet()];
  if (admins.length === 0) {
    return NextResponse.json({ success: true, skipped: "sin ADMIN_INTERNAL_EMAILS" });
  }

  const samples = recent
    .slice(0, 8)
    .map((e) => ({
      message: String(e.message ?? "(sin mensaje)").slice(0, 160),
      count: Number(e.count ?? 0),
      lastSeenAt: String(e.lastSeenAt ?? ""),
    }));

  const tpl = errorAlertEmail({
    windowMinutes: config.errorAlertWindowMinutes,
    distinctErrors,
    totalOccurrences,
    samples,
    adminUrl: `${appConfig.publicUrl.replace(/\/$/, "")}/admin`,
  });

  let sent = 0;
  for (const to of admins) {
    const r = await sendEmail({
      to,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      templateCode: "errorAlertEmail",
      relatedEntityType: "observability",
      relatedEntityId: "error_alert",
    });
    if (r.status === "sent" || r.status === "mock") sent += 1;
  }

  await firestore
    .collection(OBSERVABILITY_CONFIG_COLLECTION)
    .doc(OBSERVABILITY_CONFIG_DOC_ID)
    .set({ lastAlertAt: now.toISOString(), lastAlertAtServer: FieldValue.serverTimestamp() }, { merge: true });

  auditEvent("error_alert_sent", { distinctErrors, totalOccurrences, recipients: admins.length });

  return NextResponse.json({ success: true, sent, distinctErrors, totalOccurrences });
}
