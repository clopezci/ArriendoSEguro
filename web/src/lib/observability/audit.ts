import "server-only";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAdminInternalEmailSet } from "@/lib/admin/internal-admin";
import { isWompiConfigured } from "@/domain/platform-payments/provider-factory";
import { isTelegramConfigured, sendTelegram } from "@/services/telegram/sendTelegram";
import { ERROR_EVENTS_COLLECTION } from "@/lib/observability/observability";
import { formatAppDateTime } from "@/lib/datetime/appTime";
import { appConfig } from "@/lib/config";

/**
 * Auditoría de POSTURA (config/seguridad) de ArriendoSeguro. Revisa que las piezas
 * críticas estén configuradas y manda un reporte por Telegram (el canal de alertas
 * ya existente). Es la contraparte "sana" de las alertas de error: cada corrida
 * confirma "todo en orden" o avisa qué falta, sin depender de que ocurra un fallo.
 *
 * A prueba de fallos: si un canal no está configurado, se omite; nunca lanza.
 * Adaptar los chequeos a medida que la app gane dependencias.
 */
export type AuditLevel = "ok" | "info" | "warning";
export type AuditFinding = { key: string; level: AuditLevel; message: string };
export type AuditResult = {
  at: string;
  findings: AuditFinding[];
  summary: { ok: number; info: number; warning: number };
};

export function runPostureAudit(): AuditResult {
  const f: AuditFinding[] = [];

  // Base de datos / backend
  f.push(getAdminFirestore()
    ? { key: "firebase", level: "ok", message: "Firebase Admin / Firestore configurado." }
    : { key: "firebase", level: "warning", message: "Firebase Admin NO configurado (la app no puede leer/escribir datos)." });

  // Pagos
  f.push(isWompiConfigured()
    ? { key: "wompi", level: "ok", message: "Pasarela Wompi configurada." }
    : { key: "wompi", level: "warning", message: "Wompi NO configurado: no se puede cobrar el Plan Plus." });

  f.push(process.env.WOMPI_EVENTS_SECRET?.trim()
    ? { key: "wompi_webhook", level: "ok", message: "Secreto de eventos Wompi presente (webhook puede validarse)." }
    : { key: "wompi_webhook", level: "warning", message: "Falta WOMPI_EVENTS_SECRET: el pago no se autoconfirma por webhook (queda a la reconciliación)." });

  // Canales de alerta
  const email = Boolean(process.env.RESEND_API_KEY?.trim() && getAdminInternalEmailSet().size > 0);
  const tg = isTelegramConfigured();
  f.push(tg || email
    ? { key: "alertas", level: "ok", message: `Alertas activas por ${[tg && "Telegram", email && "correo"].filter(Boolean).join(" y ")}.` }
    : { key: "alertas", level: "info", message: "Sin canales de alerta configurados (Telegram/correo)." });

  // Cron protegido
  f.push(process.env.CRON_SECRET?.trim()
    ? { key: "cron", level: "ok", message: "Cron protegido con CRON_SECRET." }
    : { key: "cron", level: "warning", message: "CRON_SECRET no configurado: los crons quedan abiertos." });

  // IA de validación de documentos
  f.push(process.env.AI_VISION_API_KEY?.trim() || process.env.AI_API_KEY?.trim()
    ? { key: "ia", level: "ok", message: "Proveedor de IA de visión configurado (validación de documentos)." }
    : { key: "ia", level: "info", message: "IA de visión no configurada: la validación de documentos queda inactiva." });

  // Admins internos
  f.push(getAdminInternalEmailSet().size > 0
    ? { key: "admins", level: "ok", message: `Administradores internos definidos (${getAdminInternalEmailSet().size}).` }
    : { key: "admins", level: "warning", message: "No hay administradores internos definidos." });

  // URL pública
  const url = appConfig.publicUrl;
  f.push(url && !/localhost|127\.0\.0\.1/.test(url)
    ? { key: "url", level: "ok", message: `URL pública: ${url}` }
    : { key: "url", level: "info", message: `URL pública no parece de producción: ${url}` });

  const summary = {
    ok: f.filter((x) => x.level === "ok").length,
    info: f.filter((x) => x.level === "info").length,
    warning: f.filter((x) => x.level === "warning").length,
  };
  return { at: new Date().toISOString(), findings: f, summary };
}

const ICON: Record<AuditLevel, string> = { ok: "✅", info: "ℹ️", warning: "⚠️" };

export function auditToText(a: AuditResult): string {
  const head = a.summary.warning > 0
    ? `⚠️ *ArriendoSeguro — Auditoría*`
    : `✅ *ArriendoSeguro — Auditoría*`;
  return [
    head,
    `${a.summary.warning} advertencia(s), ${a.summary.info} aviso(s), ${a.summary.ok} ok.`,
    "",
    ...a.findings.map((x) => `${ICON[x.level]} ${x.message}`),
  ].join("\n");
}

/**
 * Resumen de ERRORES capturados (el "Sentry interno": colección `error_events`,
 * agrupados por huella con su contador). Es lo que hace del reporte una foto real
 * de salud, no solo de configuración. Best-effort: si no hay Firestore, null.
 */
export type ErrorSummary = {
  distinct: number;
  unresolved: number;
  occurrences: number;
  new24h: number;
  active24h: number;
  capped: boolean;
  top: { message: string; count: number; lastSeenAt: string; resolved: boolean; kind: string }[];
};

export async function summarizeErrors(): Promise<ErrorSummary | null> {
  const firestore = getAdminFirestore();
  if (!firestore) return null;
  try {
    const LIMIT = 300;
    const snap = await firestore
      .collection(ERROR_EVENTS_COLLECTION)
      .orderBy("lastSeenAt", "desc")
      .limit(LIMIT)
      .get();
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const rows = snap.docs.map((d) => d.data() as Record<string, unknown>);
    let unresolved = 0;
    let occurrences = 0;
    let new24h = 0;
    let active24h = 0;
    for (const r of rows) {
      const c = Number(r.count) || 0;
      occurrences += c;
      if (!r.resolved) unresolved += 1;
      const fs = Date.parse(String(r.firstSeenAt ?? ""));
      if (Number.isFinite(fs) && now - fs <= DAY) new24h += 1;
      const ls = Date.parse(String(r.lastSeenAt ?? ""));
      if (Number.isFinite(ls) && now - ls <= DAY) active24h += 1;
    }
    const top = [...rows]
      .sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0))
      .slice(0, 5)
      .map((r) => ({
        message: String(r.message ?? "(sin mensaje)").slice(0, 140),
        count: Number(r.count) || 0,
        lastSeenAt: String(r.lastSeenAt ?? ""),
        resolved: Boolean(r.resolved),
        kind: String(r.kind ?? "error"),
      }));
    return { distinct: rows.length, unresolved, occurrences, new24h, active24h, capped: rows.length === LIMIT, top };
  } catch {
    return null;
  }
}

export function errorSummaryToText(e: ErrorSummary | null): string {
  if (!e) return "🔎 *Errores:* sin acceso a la base (Firestore no configurado).";
  if (e.distinct === 0) return "🔎 *Errores:* 0 registrados. Todo limpio. 🎉";
  const head = e.unresolved > 0 ? "🔎 *Errores (Sentry interno)*" : "🔎 *Errores (Sentry interno)* — todos resueltos";
  const lines = [
    head,
    `Distintos: ${e.distinct}${e.capped ? "+" : ""} · sin resolver: ${e.unresolved} · nuevos 24h: ${e.new24h} · activos 24h: ${e.active24h} · ocurrencias: ${e.occurrences}`,
  ];
  if (e.top.length > 0) {
    lines.push("Top por frecuencia:");
    for (const t of e.top) {
      const when = t.lastSeenAt ? formatAppDateTime(t.lastSeenAt) : "—";
      const mark = t.resolved ? "✓" : "•";
      lines.push(`${mark} [${t.kind}] ${t.message} ×${t.count} (últ. ${when})`);
    }
  }
  return lines.join("\n");
}

/**
 * Corre la auditoría de POSTURA + el resumen de ERRORES y manda el reporte
 * completo por Telegram. Nunca lanza. El reporte lleva fecha (hora Colombia) para
 * que se vea cuándo se generó y confirmar que el cron sigue vivo.
 */
export async function sendAuditReport(): Promise<{ audit: AuditResult; errors: ErrorSummary | null; telegramSent: number }> {
  const audit = runPostureAudit();
  const errors = await summarizeErrors();
  const text = [
    auditToText(audit),
    "",
    errorSummaryToText(errors),
    "",
    `🕒 ${formatAppDateTime(audit.at)}`,
  ].join("\n");
  const tg = await sendTelegram(text).catch(() => ({ status: "failed" as const, sent: 0 }));
  return { audit, errors, telegramSent: tg.status === "sent" ? tg.sent : 0 };
}
