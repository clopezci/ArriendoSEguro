import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { contactMessageEmail, contactAckEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import { auditEvent } from "@/features/contracts/audit-server";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientIpFromRequest,
  tooManyRequestsJson,
} from "@/lib/security/rate-limit";
import { CONTACT_TOPICS } from "@/lib/contact/topics";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 16_000;

const contactSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre.").max(120),
  email: z.string().trim().toLowerCase().email("Correo no válido.").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(10, "Cuéntanos un poco más (mínimo 10 caracteres).").max(5000),
  consent: z.literal(true, { message: "Debes autorizar el tratamiento de tus datos para enviarnos el mensaje." }),
  turnstileToken: z.string().max(4000).optional(),
});

function contactInbox(): string {
  return process.env.CONTACT_INBOX_EMAIL?.trim() || "contacto@arriendoseguro.app";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Verifica Turnstile en servidor solo si está configurado y llega un token. */
async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true; // No configurado: no bloquea (igual que el resto del proyecto).
  if (!token) return process.env.NEXT_PUBLIC_TURNSTILE_REQUIRED !== "true";
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "anon") form.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean };
    return Boolean(res.ok && json.success);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const ip = clientIpFromRequest(request);
    const rate = await checkRateLimit(ip, RATE_LIMIT_RULES.contact);
    if (!rate.ok) {
      const { body, headers } = tooManyRequestsJson(rate.retryAfterSeconds);
      return NextResponse.json(body, { status: 429, headers });
    }

    const len = request.headers.get("content-length");
    if (len != null) {
      const n = Number(len);
      if (Number.isFinite(n) && n > MAX_JSON_BYTES) return jsonError("Solicitud demasiado grande", 413);
    }

    const raw = await request.text().catch(() => "");
    if (raw.length > MAX_JSON_BYTES) return jsonError("Solicitud demasiado grande", 413);

    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      return jsonError("JSON inválido", 400);
    }

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Validación", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const data = parsed.data;

    const turnstileOk = await verifyTurnstile(data.turnstileToken, ip);
    if (!turnstileOk) {
      return NextResponse.json(
        { ok: false, error: "No se pudo validar el control anti-bot. Recarga la página e inténtalo de nuevo." },
        { status: 403 },
      );
    }

    const phone = data.phone && data.phone.trim() !== "" ? data.phone.trim() : undefined;

    // Persistencia (best-effort): si Firestore no está, igual intentamos el correo.
    const firestore = getAdminFirestore();
    let messageId: string | undefined;
    if (firestore) {
      const ref = firestore.collection("contact_messages").doc();
      messageId = ref.id;
      await ref.set({
        id: ref.id,
        name: data.name,
        email: data.email,
        phone: phone ?? null,
        topic: data.topic,
        message: data.message,
        consent: true,
        status: "new",
        sourceIpMasked: ip === "anon" ? null : ip.replace(/\.\d+$/, ".x"),
        userAgent: request.headers.get("user-agent") ?? null,
        createdAt: new Date().toISOString(),
        createdAtServer: FieldValue.serverTimestamp(),
      });
    }

    const inboxTpl = contactMessageEmail({
      name: data.name,
      fromEmail: data.email,
      phone,
      topic: data.topic,
      message: data.message,
    });
    const inboxResult = await sendEmail({
      to: contactInbox(),
      subject: inboxTpl.subject,
      html: inboxTpl.html,
      text: inboxTpl.text,
      templateCode: "contactMessageEmail",
      relatedEntityType: "contact_message",
      relatedEntityId: messageId,
    });

    // Acuse al remitente (no bloquea el resultado si falla).
    const ackTpl = contactAckEmail({ name: data.name });
    await sendEmail({
      to: data.email,
      subject: ackTpl.subject,
      html: ackTpl.html,
      text: ackTpl.text,
      templateCode: "contactAckEmail",
      relatedEntityType: "contact_message",
      relatedEntityId: messageId,
    });

    auditEvent("contact_message_received", {
      messageId: messageId ?? null,
      topic: data.topic,
      inboxDelivery: inboxResult.status,
    });

    if (inboxResult.status === "failed") {
      return NextResponse.json({
        ok: true,
        stored: Boolean(messageId),
        emailNotice:
          "Recibimos tu mensaje, pero el correo interno tardó en salir. Lo revisaremos de todos modos.",
      });
    }

    return NextResponse.json({
      ok: true,
      stored: Boolean(messageId),
      message: "¡Gracias! Recibimos tu mensaje y te responderemos al correo que indicaste.",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("[/api/contact] POST falló:", err);
    return NextResponse.json(
      { ok: false, error: "Hubo un problema al enviar tu mensaje. Inténtalo de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
