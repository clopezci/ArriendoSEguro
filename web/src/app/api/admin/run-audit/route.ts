import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isInternalAdminEmail } from "@/lib/admin/internal-admin";
import { auditToText, sendAuditReport } from "@/lib/observability/audit";

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
  const { audit, telegramSent } = await sendAuditReport();
  return NextResponse.json({
    success: true,
    telegramSent,
    summary: audit.summary,
    report: auditToText(audit),
  });
}
