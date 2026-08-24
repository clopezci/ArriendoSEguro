import "server-only";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase/admin";
import { getAdminInternalEmailSet } from "@/lib/admin/internal-admin";
import { isWompiConfigured } from "@/domain/platform-payments/provider-factory";
import { isTelegramConfigured, sendTelegram, type SendTelegramOutput } from "@/services/telegram/sendTelegram";
import { ERROR_EVENTS_COLLECTION } from "@/lib/observability/observability";
import { isBenignClientError } from "@/lib/observability/ignore-noise";
import { recordObservabilityRun } from "@/lib/observability/runlog";
import { summarizeGa4Visits, ga4VisitsToText, type Ga4Visits } from "@/lib/observability/ga4";
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
  surveys: number | null;
  surveys24h: number | null;
  contracts: number | null;
  contracts24h: number | null;
  signed: number | null;
  payments: number | null;
  payments24h: number | null;
  plusPaid: number | null;
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
  const [surveys, surveys24h, contracts, contracts24h, signed, payments, payments24h, plusPaid, reviews] = await Promise.all([
    safeCount(firestore.collection("lead_forms")),
    safeCount(firestore.collection("lead_forms").where("createdAt", ">=", dayAgo)),
    safeCount(firestore.collection("contracts")),
    safeCount(firestore.collection("contracts").where("createdAt", ">=", dayAgo)),
    safeCount(firestore.collection("signatures").where("signatureStatus", "==", "signed")),
    // OJO: platform_payments guarda el estado del PSP en MAYÚSCULAS ("APPROVED").
    safeCount(firestore.collection("platform_payments").where("status", "==", "APPROVED")),
    safeCount(firestore.collection("platform_payments").where("status", "==", "APPROVED").where("createdAt", ">=", dayAgo)),
    // "Cuántos compraron" de forma estable: accesos Plan Plus pagados y activos.
    safeCount(firestore.collection("access_entitlements").where("status", "==", "active").where("accessType", "==", "plus_paid")),
    safeCount(firestore.collection("reputation_reviews")),
  ]);
  return { surveys, surveys24h, contracts, contracts24h, signed, payments, payments24h, plusPaid, reviews };
}

/** % con 1 decimal (o null si no hay denominador). */
function pct(num: number | null, den: number | null): number | null {
  return num != null && den != null && den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

export function activityToText(a: ActivitySummary | null): string {
  if (!a) return "📊 *Actividad:* sin acceso a la base.";
  const n = (v: number | null) => (v === null ? "—" : String(v));
  const p = (v: number | null) => (v === null ? "—" : `${v}%`);
  return [
    "📊 *Actividad y embudo*",
    `Encuestas: ${n(a.surveys)} (24h: ${n(a.surveys24h)})`,
    `Contratos: ${n(a.contracts)} (24h: ${n(a.contracts24h)}) · firmados: ${n(a.signed)}`,
    `Compras (Plan Plus): ${n(a.plusPaid)} · pagos aprobados: ${n(a.payments)} (24h: ${n(a.payments24h)}) · calificaciones: ${n(a.reviews)}`,
    `Conversión → firma/contrato: ${p(pct(a.signed, a.contracts))} · compra/contrato: ${p(pct(a.plusPaid, a.contracts))}`,
  ].join("\n");
}

/**
 * Indicadores LEAN clave para el reporte: ingresos, LTV/CAC, k viral, tiempo a
 * convertir y la cohorte de la semana con su tendencia. Compacto y best-effort
 * (cada pieza guardada); si falta la base, devuelve null.
 */
export type LeanReport = {
  revenueTotal: number;
  revenue30: number;
  ticket: number | null;
  ltv: number | null;
  cac: number | null;
  ltvCac: number | null;
  viralK: number | null;
  acceptanceRate: number | null;
  medianDaysToConvert: number | null;
  cohortWeek: string | null;
  cohortActivatedPct: number | null;
  cohortTrend: "up" | "flat" | "down" | "na";
};

export async function summarizeLean(): Promise<LeanReport | null> {
  const db = getAdminFirestore();
  if (!db) return null;
  const auth = getAdminAuth();
  const NOW = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const toMs = (v: unknown): number | null => {
    const asTs = v as { toDate?: () => Date } | null;
    if (asTs?.toDate) return asTs.toDate().getTime();
    if (typeof v === "string") { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
    return null;
  };
  try {
    const [paySnap, entSnap, invSnap, mkDoc] = await Promise.all([
      db.collection("platform_payments").where("status", "==", "APPROVED").limit(2000).get().catch(() => null),
      db.collection("access_entitlements").limit(500).get().catch(() => null),
      db.collection("party_invites").limit(3000).get().catch(() => null),
      db.collection("admin_config").doc("marketing").get().catch(() => null),
    ]);

    let total = 0, r30 = 0, count = 0, count30 = 0;
    const firstPayByEmail = new Map<string, number>();
    (paySnap?.docs ?? []).forEach((d) => {
      const x = d.data() as Record<string, unknown>;
      const amt = Number(x.amount ?? 0) || 0;
      const at = toMs(x.approvedAt) ?? toMs(x.createdAtServer) ?? toMs(x.createdAt);
      total += amt; count += 1;
      if (at != null) {
        if (NOW - at <= 30 * DAY) { r30 += amt; count30 += 1; }
        const em = String(x.userEmail ?? "").toLowerCase();
        if (em) { const p = firstPayByEmail.get(em); if (p == null || at < p) firstPayByEmail.set(em, at); }
      }
    });
    const ticket = count > 0 ? Math.round(total / count) : null;

    const leasesByUid = new Map<string, Set<string>>();
    const payerUids = new Set<string>();
    (entSnap?.docs ?? []).forEach((d) => {
      const x = d.data() as Record<string, unknown>;
      const uid = String(x.userId ?? ""); const lease = String(x.leaseProcessId ?? "");
      if (uid && lease) { const s = leasesByUid.get(uid) ?? new Set<string>(); s.add(lease); leasesByUid.set(uid, s); }
      if (uid && String(x.accessType ?? "") === "plus_paid") payerUids.add(uid);
    });
    let ltv: number | null = null;
    if (payerUids.size > 0 && ticket != null) {
      let l = 0; payerUids.forEach((u) => { l += leasesByUid.get(u)?.size ?? 0; });
      ltv = Math.round(ticket * Math.max(1, l / payerUids.size));
    }

    const spend = Number((mkDoc?.data() as Record<string, unknown> | undefined)?.monthlyCop ?? 0) || 0;
    const cac = spend > 0 && count30 > 0 ? Math.round(spend / count30) : null;
    const ltvCac = cac != null && cac > 0 && ltv != null ? Math.round((ltv / cac) * 100) / 100 : null;

    const invitesSent = invSnap?.size ?? 0;
    const invitesAccepted = (invSnap?.docs ?? []).filter((d) => Boolean((d.data() as Record<string, unknown>).completedAt)).length;
    const acceptanceRate = invitesSent > 0 ? invitesAccepted / invitesSent : null;

    // Auth: registrados + fechas de alta (para k, tiempo a convertir y cohortes).
    let registered = 0;
    const createdByUid = new Map<string, number>();
    const uidByEmail = new Map<string, string>();
    if (auth) {
      let token: string | undefined;
      for (let p = 0; p < 10; p++) {
        const res = await auth.listUsers(1000, token);
        registered += res.users.length;
        res.users.forEach((u) => {
          const c = u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : NaN;
          if (Number.isFinite(c)) createdByUid.set(u.uid, c);
          const em = (u.email ?? "").toLowerCase(); if (em) uidByEmail.set(em, u.uid);
        });
        token = res.pageToken; if (!token) break;
      }
    }
    const invitesPerUser = registered > 0 ? invitesSent / registered : null;
    const viralK = invitesPerUser != null && acceptanceRate != null ? Math.round(invitesPerUser * acceptanceRate * 100) / 100 : null;

    const convDays: number[] = [];
    firstPayByEmail.forEach((at, em) => { const uid = uidByEmail.get(em); const c = uid ? createdByUid.get(uid) : null; if (c != null && at >= c) convDays.push((at - c) / DAY); });
    const sc = [...convDays].sort((a, b) => a - b);
    const medianDaysToConvert = sc.length ? Math.round(sc[Math.floor(sc.length / 2)] * 10) / 10 : null;

    const activatedUids = new Set<string>(leasesByUid.keys());
    const weekKey = (ms: number) => { const d = new Date(ms); const dow = (d.getUTCDay() + 6) % 7; const mon = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow); const md = new Date(mon); return { key: `${String(md.getUTCDate()).padStart(2, "0")}/${String(md.getUTCMonth() + 1).padStart(2, "0")}`, order: Math.floor(mon / (7 * DAY)) }; };
    const cmap = new Map<string, { order: number; size: number; act: number }>();
    createdByUid.forEach((c, uid) => { if (NOW - c > 8 * 7 * DAY) return; const { key, order } = weekKey(c); const o = cmap.get(key) ?? { order, size: 0, act: 0 }; o.size += 1; if (activatedUids.has(uid)) o.act += 1; cmap.set(key, o); });
    const carr = [...cmap.entries()].sort((a, b) => a[1].order - b[1].order).map(([week, c]) => ({ week, pct: c.size > 0 ? Math.round((c.act / c.size) * 100) : 0 }));
    const last = carr[carr.length - 1]; const prev = carr[carr.length - 2];
    let cohortTrend: "up" | "flat" | "down" | "na" = "na";
    if (last && prev) cohortTrend = last.pct > prev.pct + 2 ? "up" : last.pct < prev.pct - 2 ? "down" : "flat";

    return {
      revenueTotal: total, revenue30: r30, ticket, ltv, cac, ltvCac, viralK,
      acceptanceRate: acceptanceRate != null ? Math.round(acceptanceRate * 1000) / 10 : null,
      medianDaysToConvert,
      cohortWeek: last?.week ?? null, cohortActivatedPct: last?.pct ?? null, cohortTrend,
    };
  } catch {
    return null;
  }
}

export function leanToText(l: LeanReport | null): string {
  if (!l) return "📈 *Lean:* sin acceso a la base.";
  const cop = (v: number | null) => (v == null ? "—" : `$${v.toLocaleString("es-CO")}`);
  const trend = l.cohortTrend === "up" ? "🟢" : l.cohortTrend === "down" ? "🔴" : l.cohortTrend === "flat" ? "🟡" : "—";
  return [
    "📈 *Lean*",
    `Ingresos: ${cop(l.revenueTotal)} (30d: ${cop(l.revenue30)}) · ticket ${cop(l.ticket)}`,
    `LTV ${cop(l.ltv)} · CAC ${cop(l.cac)} · LTV/CAC ${l.ltvCac != null ? `${l.ltvCac}×` : "—"}`,
    `k viral ${l.viralK ?? "—"} (aceptación ${l.acceptanceRate != null ? `${l.acceptanceRate}%` : "—"}) · a pagar ${l.medianDaysToConvert != null ? `${l.medianDaysToConvert}d` : "—"}`,
    `Cohorte ${l.cohortWeek ?? "—"}: activación ${l.cohortActivatedPct != null ? `${l.cohortActivatedPct}%` : "—"} ${trend}`,
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
  visits: Ga4Visits | null;
  lean: LeanReport | null;
  telegram: SendTelegramOutput;
  telegramSent: number;
}> {
  const audit = runPostureAudit();
  const [errors, activity, visits, lean] = await Promise.all([summarizeErrors(), summarizeActivity(), summarizeGa4Visits(), summarizeLean()]);
  const text = [
    auditToText(audit),
    "",
    ga4VisitsToText(visits),
    "",
    activityToText(activity),
    "",
    leanToText(lean),
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
  return { audit, errors, activity, visits, lean, telegram: tg, telegramSent: tg.status === "sent" ? tg.sent : 0 };
}
