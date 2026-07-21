import "server-only";
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
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
import { sendTelegram } from "@/services/telegram/sendTelegram";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";

export type ErrorAlertResult = {
  sent: boolean;
  reason?: string;
  distinctErrors?: number;
  totalOccurrences?: number;
  emailSent?: number;
  telegramSent?: number;
};

/**
 * Evalúa los errores recientes y, si superan el umbral y pasó el "cooldown",
 * envía la alerta por **correo y Telegram**. Compartida por el cron
 * (`error-alert/send-due`) y por la ingesta de errores del navegador
 * (`client-error`), para que el aviso llegue AL INSTANTE sin depender de la
 * frecuencia del cron.
 *
 * Para no saturar (el endpoint de ingesta es público), corta barato por
 * enabled/cooldown ANTES de la consulta costosa y "reclama" el turno escribiendo
 * `lastAlertAt` antes de enviar, de modo que ráfagas de errores no dupliquen.
 */
export async function maybeSendErrorAlert(firestore: Firestore): Promise<ErrorAlertResult> {
  const cfgRef = firestore.collection(OBSERVABILITY_CONFIG_COLLECTION).doc(OBSERVABILITY_CONFIG_DOC_ID);
  const cfgSnap = await cfgRef.get();
  const config = resolveObservabilityConfig(cfgSnap.exists ? cfgSnap.data() : undefined);

  // Cortes baratos antes de la consulta de 200 documentos.
  if (!config.errorAlertEnabled) return { sent: false, reason: "alertas deshabilitadas" };
  const nowMs = Date.now();
  if (config.lastAlertAt) {
    const last = Date.parse(config.lastAlertAt);
    if (Number.isFinite(last) && nowMs - last < config.errorAlertCooldownMinutes * 60_000) {
      return { sent: false, reason: "en período de enfriamiento" };
    }
  }

  const now = new Date(nowMs);
  const windowStart = nowMs - config.errorAlertWindowMinutes * 60_000;

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

  const decision = shouldSendErrorAlert(config, distinctErrors, nowMs);
  if (!decision.send) return { sent: false, reason: decision.reason, distinctErrors };

  // Reclamamos el turno YA (evita duplicar en ráfagas concurrentes).
  await cfgRef.set(
    { lastAlertAt: now.toISOString(), lastAlertAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );

  const samples = recent.slice(0, 8).map((e) => ({
    message: String(e.message ?? "(sin mensaje)").slice(0, 160),
    count: Number(e.count ?? 0),
    lastSeenAt: String(e.lastSeenAt ?? ""),
  }));
  const adminUrl = `${appConfig.publicUrl.replace(/\/$/, "")}/admin`;

  // Correo a los administradores.
  const admins = [...getAdminInternalEmailSet()];
  let emailSent = 0;
  if (admins.length > 0) {
    const tpl = errorAlertEmail({
      windowMinutes: config.errorAlertWindowMinutes,
      distinctErrors,
      totalOccurrences,
      samples,
      adminUrl,
    });
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
      if (r.status === "sent" || r.status === "mock") emailSent += 1;
    }
  }

  // Telegram (instantáneo, sin plantillas).
  const tgLines = samples
    .slice(0, 5)
    .map((s) => `• (${s.count}) ${s.message}`)
    .join("\n");
  const tgText =
    `🚨 *ArriendoSeguro — errores*\n` +
    `${distinctErrors} tipo(s), ${totalOccurrences} ocurrencia(s) en ${config.errorAlertWindowMinutes} min.\n\n` +
    `${tgLines}\n\n[Abrir panel](${adminUrl})`;
  const tg = await sendTelegram(tgText).catch(() => ({ status: "failed" as const, sent: 0 }));
  const telegramSent = tg.status === "sent" ? tg.sent : 0;

  auditEvent("error_alert_sent", {
    distinctErrors,
    totalOccurrences,
    recipients: admins.length,
    emailSent,
    telegramSent,
  });

  return { sent: true, distinctErrors, totalOccurrences, emailSent, telegramSent };
}
