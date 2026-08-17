import "server-only";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAdminInternalEmailSet } from "@/lib/admin/internal-admin";
import { isWompiConfigured } from "@/domain/platform-payments/provider-factory";
import { isTelegramConfigured, sendTelegram, type SendTelegramOutput } from "@/services/telegram/sendTelegram";
import { ERROR_EVENTS_COLLECTION } from "@/lib/observability/observability";
import { isBenignClientError } from "@/lib/observability/ignore-noise";
import { recordObservabilityRun } from "@/lib/observability/runlog";
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

  // IA de validación de documentos: cadena de proveedores (Groq→Gemini→OpenAI).
  // Antes revisaba AI_VISION_API_KEY (obsoleto) y salía "en gris" aunque la IA
  // estuviera configurada. Ahora comprueba las llaves reales de la cadena.
  const aiProviders: string[] = [];
  if (process.env.GROQ_API_KEY?.trim() || process.env.AI_API_KEY?.trim()) aiProviders.push("Groq");
  if (process.env.GEMINI_API_KEY?.trim()) aiProviders.push("Gemini");
  if (process.env.OPENAI_API_KEY?.trim()) aiProviders.push("OpenAI");
  f.push(aiProviders.length > 0
    ? { key: "ia", level: "ok", message: `IA de documentos configurada (cadena: ${aiProviders.join(" → ")}).` }
    : { key: "ia", level: "info", message: "IA de documentos no configurada (falta GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY): la validación queda inactiva." });

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
    // Excluimos el ruido benigno (terceros/extensiones) del conteo y del top: si
    // ya lo silenciamos como no accionable, tampoco debe ensuciar la auditoría.
    const rows = snap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((r) => !isBenignClientError(String(r.message ?? "")));
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
 * Foto de ACTIVIDAD del negocio (totales + últimas 24 h). Usa agregaciones
 * `count()` (baratas) y es best-effort: si una consulta falla, ese dato va null.
 */
export type ActivitySummary = {
  contracts: number | null;
  contracts24h: number | null;
  signed: number | null;
  payments: number | null;
  reviews: number | null;
};

export async function summarizeActivity(): Promise<ActivitySummary | null> {
  const firestore = getAdminFirestore();
  if (!firestore) return null;
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const safeCount = async (q: FirebaseFirestore.Query): Promise<number | null> => {
    try {
      const s = await q.count().get();
      return s.data().count;
    } catch {
      return null;
    }
  };
  const [contracts, contracts24h, signed, payments, reviews] = await Promise.all([
    safeCount(firestore.collection("contracts")),
    safeCount(firestore.collection("contracts").where("createdAt", ">=", dayAgo)),
    safeCount(firestore.collection("signatures").where("signatureStatus", "==", "signed")),
    safeCount(firestore.collection("platform_payments").where("status", "==", "APPROVED")),
    safeCount(firestore.collection("reputation_reviews")),
  ]);
  return { contracts, contracts24h, signed, payments, reviews };
}

export function activityToText(a: ActivitySummary | null): string {
  if (!a) return "📊 *Actividad:* sin acceso a la base.";
  const n = (v: number | null) => (v === null ? "—" : String(v));
  return [
    "📊 *Actividad*",
    `Contratos: ${n(a.contracts)} (nuevos 24h: ${n(a.contracts24h)}) · firmas completadas: ${n(a.signed)} · pagos aprobados: ${n(a.payments)} · calificaciones: ${n(a.reviews)}`,
  ].join("\n");
}

/**
 * Corre la auditoría de POSTURA + ACTIVIDAD + resumen de ERRORES y manda el
 * reporte completo por Telegram. Nunca lanza. Lleva fecha (hora Colombia) para
 * que se vea cuándo se generó y confirmar que el cron sigue vivo.
 */
export async function sendAuditReport(source = "manual_admin"): Promise<{
  audit: AuditResult;
  errors: ErrorSummary | null;
  activity: ActivitySummary | null;
  telegram: SendTelegramOutput;
  telegramSent: number;
}> {
  const audit = runPostureAudit();
  const [errors, activity] = await Promise.all([summarizeErrors(), summarizeActivity()]);
  const text = [
    auditToText(audit),
    "",
    activityToText(activity),
    "",
    errorSummaryToText(errors),
    "",
    `🕒 ${formatAppDateTime(audit.at)}`,
  ].join("\n");
  const tg = await sendTelegram(text).catch(
    (err): SendTelegramOutput => ({
      status: "failed",
      sent: 0,
      errorMessage: err instanceof Error ? err.message : "Error inesperado al enviar a Telegram",
    }),
  );
  // Heartbeat: deja rastro de ESTA corrida (cron o manual) para diagnóstico.
  await recordObservabilityRun({
    at: audit.at,
    source,
    telegramStatus: tg.status,
    telegramSent: tg.status === "sent" ? tg.sent : 0,
    telegramError: tg.errorMessage ?? null,
    notes: `warnings:${audit.summary.warning} errores:${errors ? errors.distinct : "sin-acceso-db"}`,
  });
  return { audit, errors, activity, telegram: tg, telegramSent: tg.status === "sent" ? tg.sent : 0 };
}
