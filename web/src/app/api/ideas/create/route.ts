import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { sendEmail } from "@/services/email/sendEmail";
import { productIdeaEmail } from "@/services/email/emailTemplates";
import { sendTelegram } from "@/services/telegram/sendTelegram";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientIpFromRequest,
  tooManyRequestsJson,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 16_000;
const PRODUCT_IDEAS_COLLECTION = "product_ideas";

const schema = z.object({
  name: z.string().trim().min(2, "Dinos tu nombre.").max(120),
  contact: z.string().trim().max(160).optional().or(z.literal("")),
  idea: z.string().trim().min(10, "Cuéntanos un poco más (mínimo 10 caracteres).").max(4000),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * "Déjanos tu idea/necesidad" (#6): captura ideas de mejora de los usuarios.
 * Guarda en `product_ideas` y avisa por correo + Telegram. Auth opcional.
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
      return NextResponse.json({ ok: false, error: "Validación", issues: parsed.error.flatten() }, { status: 422 });
    }
    const data = parsed.data;

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { ok: false, error: "No se pudo registrar tu idea (servidor no configurado)." },
        { status: 503 },
      );
    }

    const authed = await getAuthenticatedUser(request).catch(() => null);
    const contact = (data.contact && data.contact.trim() !== "" ? data.contact.trim() : authed?.email) ?? null;
    const idea = data.idea.trim().slice(0, 4000);

    const ref = firestore.collection(PRODUCT_IDEAS_COLLECTION).doc();
    await ref.set({
      id: ref.id,
      name: data.name.trim().slice(0, 120),
      contact,
      idea,
      authorUid: authed?.uid ?? null,
      isAuthenticated: Boolean(authed),
      status: "new",
      userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      sourceIpMasked: ip === "anon" ? null : ip.replace(/\.\d+$/, ".x"),
      createdAt: new Date().toISOString(),
      createdAtServer: FieldValue.serverTimestamp(),
    });

    auditEvent("product_idea_submitted", { ideaId: ref.id, authenticated: Boolean(authed) });

    const inbox =
      process.env.REPORTS_INBOX_EMAIL?.trim() ||
      process.env.CONTACT_INBOX_EMAIL?.trim() ||
      "contacto@arriendoseguro.app";
    try {
      const tpl = productIdeaEmail({ name: data.name.trim(), contact, idea });
      await sendEmail({
        to: inbox,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateCode: "productIdeaEmail",
        relatedEntityType: "idea",
        relatedEntityId: ref.id,
      });
    } catch {
      /* la idea ya quedó guardada */
    }
    try {
      await sendTelegram(`💡 *Nueva idea* — ${data.name.trim()}\nContacto: ${contact ?? "—"}\n\n${idea.slice(0, 1500)}`);
    } catch {
      /* Telegram complementario */
    }

    return NextResponse.json({
      ok: true,
      message: "¡Gracias! Recibimos tu idea. Si nos sirve para muchos, la construimos sin costo.",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[/api/ideas/create]", err);
    return jsonError("No se pudo enviar tu idea. Inténtalo de nuevo en unos minutos.", 500);
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
