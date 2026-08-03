import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmail } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { ERROR_EVENTS_COLLECTION } from "@/lib/observability/observability";
import { sendTelegram, isTelegramConfigured } from "@/services/telegram/sendTelegram";
import { recentObservabilityRuns, recordObservabilityRun } from "@/lib/observability/runlog";
import { formatAppDateTime } from "@/lib/datetime/appTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AUTO-DIAGNÓSTICO de observabilidad (solo admin interno). Revela los errores
 * SILENCIOSOS que normalmente se tragan los try/catch: prueba Firestore, cuenta
 * variables de entorno presentes, hace un ENVÍO REAL de prueba a Telegram y
 * devuelve la respuesta cruda, y muestra las últimas corridas del cron (heartbeat)
 * para ver si el cron está disparando o no. Pensado para dejarlo temporalmente y
 * quitarlo cuando quede resuelto.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!isInternalAdminEmail(auth.user.email)) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const checks: Record<string, unknown> = {};

  // 1) Variables de entorno presentes (sin exponer valores).
  const envPresent = (k: string) => Boolean(process.env[k]?.trim());
  checks.env = {
    TELEGRAM_BOT_TOKEN: envPresent("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_CHAT_ID: envPresent("TELEGRAM_CHAT_ID"),
    CRON_SECRET: envPresent("CRON_SECRET"),
    RESEND_API_KEY: envPresent("RESEND_API_KEY"),
    ADMIN_INTERNAL_EMAILS: envPresent("ADMIN_INTERNAL_EMAILS"),
    FIREBASE_SERVICE_ACCOUNT_KEY: envPresent("FIREBASE_SERVICE_ACCOUNT_KEY"),
    telegramChatCount: (process.env.TELEGRAM_CHAT_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean).length,
    telegramConfigured: isTelegramConfigured(),
  };

  // 2) Firestore realmente accesible (esto SÍ suele fallar en silencio).
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      checks.firestore = { ok: false, error: "getAdminFirestore() devolvió null (Firebase Admin no inicializado)." };
    } else {
      const started = Date.now();
      const snap = await firestore.collection(ERROR_EVENTS_COLLECTION).limit(1).get();
      checks.firestore = { ok: true, ms: Date.now() - started, errorEventsSample: snap.size };
    }
  } catch (err) {
    checks.firestore = { ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }

  // 3) Envío REAL de prueba a Telegram, con la respuesta cruda.
  const tg = await sendTelegram(
    `🧪 *ArriendoSeguro — prueba de diagnóstico*\nSi ves esto, Telegram funciona.\n🕒 ${formatAppDateTime(now)}`,
  ).catch((err) => ({ status: "failed" as const, sent: 0, errorMessage: err instanceof Error ? err.message : "excepción" }));
  checks.telegramTest = tg;

  // 4) Heartbeat: últimas corridas de cron/reporte (¿está disparando el cron?).
  const runs = await recentObservabilityRuns(15);
  checks.recentRuns = runs;
  checks.recentRunsHint =
    runs.length === 0
      ? "No hay corridas registradas: el cron NUNCA ha disparado desde este deploy, o Firestore no guarda. Revisa que el cron exista en Vercel (Settings → Cron Jobs) y que CRON_SECRET esté puesto."
      : `La última corrida fue ${formatAppDateTime(runs[0]?.at ?? now)} (fuente: ${runs[0]?.source}). Si es vieja, el cron dejó de disparar.`;

  await recordObservabilityRun({
    at: now,
    source: "selftest",
    telegramStatus: tg.status,
    telegramSent: tg.status === "sent" ? tg.sent : 0,
    telegramError: tg.errorMessage ?? null,
    notes: `firestore:${(checks.firestore as { ok?: boolean })?.ok ? "ok" : "fallo"}`,
  });

  return NextResponse.json({ success: true, at: now, checks });
}
