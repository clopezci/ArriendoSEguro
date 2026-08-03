import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cron";
import { sendAuditReport } from "@/lib/observability/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tarea del cron: corre la auditoría de postura y manda el reporte por Telegram.
 * La invoca el despachador `/api/cron/daily` (mismo CRON_SECRET). También se puede
 * llamar directo con `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;
  const { audit, errors, telegramSent } = await sendAuditReport();
  return NextResponse.json({ success: true, telegramSent, summary: audit.summary, errors });
}

/** Vercel Cron llama por GET. Cron dedicado (cada 6 h en Pro) para el reporte. */
export async function GET(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;
  const { audit, errors, telegramSent } = await sendAuditReport();
  return NextResponse.json({ success: true, telegramSent, summary: audit.summary, errors });
}
