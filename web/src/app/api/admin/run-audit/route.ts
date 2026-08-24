import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmail } from "@/lib/admin/internal-admin";
import { auditToText, errorSummaryToText, activityToText, leanToText, sendAuditReport } from "@/lib/observability/audit";
import { ga4VisitsToText } from "@/lib/observability/ga4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Corre la auditoría de postura AHORA y la manda por Telegram (solo admin interno).
 * Sirve para probar el reporte a demanda desde el panel y ver el resultado.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  if (!isInternalAdminEmail(auth.user.email)) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }
  const { audit, errors, activity, visits, lean, telegram, telegramSent } = await sendAuditReport();

  // Línea de diagnóstico CLARA para el panel: dice si Telegram envió, si no está
  // configurado (mock) o por qué falló. Así se ve en un clic qué pasa con el envío.
  const tgLine =
    telegram.status === "sent"
      ? `✅ Telegram: enviado a ${telegram.sent} chat(s).`
      : telegram.status === "mock"
        ? "⚠️ Telegram: NO configurado en el servidor (faltan TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID en Vercel). Por eso no llegan mensajes."
        : `🛑 Telegram: falló el envío. ${telegram.errorMessage ?? "sin detalle"}`;

  return NextResponse.json({
    success: true,
    telegramSent,
    telegram,
    summary: audit.summary,
    errors,
    report: [tgLine, "", auditToText(audit), "", ga4VisitsToText(visits), "", activityToText(activity), "", leanToText(lean), "", errorSummaryToText(errors)].join("\n"),
  });
}
