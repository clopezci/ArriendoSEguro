import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { USER_REPORTS_COLLECTION, maskPii } from "@/lib/observability/observability";
import { REPORT_CATEGORIES } from "@/lib/reports/report-categories";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientIpFromRequest,
  tooManyRequestsJson,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 16_000;

const schema = z.object({
  category: z.enum(REPORT_CATEGORIES),
  message: z.string().trim().min(10, "Cuéntanos un poco más (mínimo 10 caracteres).").max(5000),
  email: z.string().trim().toLowerCase().email().max(160).optional().or(z.literal("")),
  pageUrl: z.string().trim().max(600).optional(),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Reporte de usuario (bug, error, queja, sugerencia). La autenticación es
 * opcional: si llega un token válido, asociamos uid/correo; si no, usamos el
 * correo opcional del formulario. Se guarda en `user_reports` para el panel.
 */
export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const rate = await checkRateLimit(ip, RATE_LIMIT_RULES.reports);
    if (!rate.ok) {
      const { body, headers } = tooManyRequestsJson(rate.retryAfterSeconds);
      return NextResponse.json(body, { status: 429, headers });
    }

    const raw = await request.text().catch(() => "");
    if (raw.length > MAX_JSON_BYTES) return jsonError("Solicitud demasiado grande", 413);

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(raw) as unknown;
    } catch {
      return jsonError("JSON inválido", 400);
    }

    const parsed = schema.safeParse(parsedBody);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validación", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const data = parsed.data;

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { ok: false, error: "No se pudo registrar el reporte (servidor no configurado)." },
        { status: 503 },
      );
    }

    // Identidad opcional desde el token (no obligatoria).
    const authed = await getAuthenticatedUser(request).catch(() => null);
    const reporterEmail =
      authed?.email ?? (data.email && data.email.trim() !== "" ? data.email.trim().toLowerCase() : null);

    const ref = firestore.collection(USER_REPORTS_COLLECTION).doc();
    await ref.set({
      id: ref.id,
      category: data.category,
      message: data.message.trim().slice(0, 5000),
      reporterEmail,
      reporterUid: authed?.uid ?? null,
      isAuthenticated: Boolean(authed),
      status: "new",
      pageUrl: data.pageUrl ? maskPii(data.pageUrl, 600) : null,
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      sourceIpMasked: ip === "anon" ? null : ip.replace(/\.\d+$/, ".x"),
      createdAt: new Date().toISOString(),
      createdAtServer: FieldValue.serverTimestamp(),
    });

    auditEvent("user_report_submitted", {
      reportId: ref.id,
      category: data.category,
      authenticated: Boolean(authed),
    });

    return NextResponse.json({
      ok: true,
      message: "¡Gracias! Recibimos tu reporte y lo revisaremos.",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[/api/reports/create]", err);
    return jsonError("No se pudo enviar el reporte. Inténtalo de nuevo en unos minutos.", 500);
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
