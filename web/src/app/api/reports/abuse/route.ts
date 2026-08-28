import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { USER_REPORTS_COLLECTION } from "@/lib/observability/observability";
import { sendEmail } from "@/services/email/sendEmail";
import { sendTelegram } from "@/services/telegram/sendTelegram";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientIpFromRequest,
  tooManyRequestsJson,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  area: z.enum(["mantenimiento", "reputacion", "otro"]),
  contractId: z.string().trim().max(200).optional(),
  targetId: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(5, "Cuéntanos por qué reportas (mínimo 5 caracteres).").max(2000),
});

function areaLabel(area: string): string {
  return area === "mantenimiento"
    ? "Mantenimiento / solicitudes"
    : area === "reputacion"
      ? "Reputación / calificación"
      : "Otro";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

/**
 * Reporte de CONTENIDO/ABUSO entre partes de un contrato (mensajes/fotos de
 * mantenimiento o calificaciones de reputación). Exige sesión (el que reporta es
 * una parte del contrato). Guarda en `user_reports` (para el panel) y avisa al
 * equipo por correo y Telegram. Cumple la política de UGC de Google Play.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const rate = await checkRateLimit(ip, RATE_LIMIT_RULES.reports);
    if (!rate.ok) {
      const { body, headers } = tooManyRequestsJson(rate.retryAfterSeconds);
      return NextResponse.json(body, { status: 429, headers });
    }

    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Validación", issues: parsed.error.flatten() }, { status: 422 });
    }
    const data = parsed.data;

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ ok: false, error: "Servidor no configurado." }, { status: 503 });
    }

    const ref = firestore.collection(USER_REPORTS_COLLECTION).doc();
    await ref.set({
      id: ref.id,
      category: "abuso",
      area: data.area,
      contractId: data.contractId ?? null,
      targetId: data.targetId ?? null,
      message: data.reason,
      reporterEmail: auth.user.email ?? null,
      reporterUid: auth.user.uid,
      isAuthenticated: true,
      status: "new",
      createdAt: new Date().toISOString(),
      createdAtServer: FieldValue.serverTimestamp(),
    });

    auditEvent("abuse_report_submitted", { reportId: ref.id, area: data.area, contractId: data.contractId ?? null });

    // Aviso inmediato al equipo (best-effort): correo + Telegram.
    const inbox =
      process.env.REPORTS_INBOX_EMAIL?.trim() ||
      process.env.CONTACT_INBOX_EMAIL?.trim() ||
      "contacto@arriendoseguro.app";
    const label = areaLabel(data.area);
    const ctx = `Área: ${label}\nContrato: ${data.contractId ?? "—"}\nÍtem: ${data.targetId ?? "—"}\nDe: ${auth.user.email ?? auth.user.uid}`;
    try {
      await sendEmail({
        to: inbox,
        subject: `🚩 Reporte de contenido/abuso — ${label}`,
        text: `${ctx}\n\nMotivo:\n${data.reason}`,
        html: `<p><b>🚩 Reporte de contenido/abuso</b></p><p>${ctx.replace(/\n/g, "<br>")}</p><p><b>Motivo:</b><br>${escapeHtml(data.reason)}</p>`,
        templateCode: "userReportEmail",
        relatedEntityType: "report",
        relatedEntityId: ref.id,
      });
    } catch {
      /* el reporte ya quedó guardado; el correo es complementario */
    }
    try {
      await sendTelegram(
        `🚩 *Reporte de contenido/abuso* — ${label}\nContrato: ${data.contractId ?? "—"}\nÍtem: ${data.targetId ?? "—"}\nDe: ${auth.user.email ?? auth.user.uid}\n\n${data.reason.slice(0, 1500)}`,
      );
    } catch {
      /* Telegram es complementario */
    }

    return NextResponse.json({ ok: true, message: "Gracias. Recibimos tu reporte y lo revisaremos." });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[/api/reports/abuse]", err);
    return NextResponse.json({ ok: false, error: "No se pudo enviar el reporte. Inténtalo de nuevo." }, { status: 500 });
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
