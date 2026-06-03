import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { leadFormSchema } from "@/lib/validations/lead-form";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { surveyThankYouEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientIpFromRequest,
  tooManyRequestsJson,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 32_000;

/**
 * Correos que omiten la comprobación de duplicado en `lead_forms` (pruebas repetidas
 * sin bloqueo). Incluye correo interno acordado; amplía con `LEAD_FORM_DEDUP_BYPASS_EMAILS`
 * en Vercel (lista separada por comas, sin espacios obligatorios).
 */
function leadDedupBypassEmails(): Set<string> {
  const fromEnv =
    process.env.LEAD_FORM_DEDUP_BYPASS_EMAILS?.split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0) ?? [];
  return new Set(["clopezci@hotmail.com", ...fromEnv]);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function methodNotAllowed() {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "POST, OPTIONS" },
  });
}

export function GET() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Lead público: validación con Zod, tope de tamaño, email normalizado,
 * y evita duplicar por el mismo correo (cuando el usuario lo informa), salvo
 * correos en la lista de omisión de deduplicación (pruebas; ver `leadDedupBypassEmails`).
 * Abuso: mitigar más adelante con rate limit (Edge/KV) o reglas de red en Vercel.
 *
 * Importante: este handler siempre debe responder JSON estructurado
 * ({ ok, error, message }), incluso ante fallos del backend, para que el
 * formulario pueda mostrar un mensaje útil y no caiga al catch genérico.
 */
export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (err) {
    console.error("[/api/leads] POST falló:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Hubo un problema temporal al guardar tu respuesta. Por favor inténtalo de nuevo en unos minutos.",
      },
      { status: 500 },
    );
  }
}

async function handlePost(request: Request) {
  const rate = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.leads);
  if (!rate.ok) {
    const { body, headers } = tooManyRequestsJson(rate.retryAfterSeconds);
    return NextResponse.json(body, { status: 429, headers });
  }

  const len = request.headers.get("content-length");
  if (len != null) {
    const n = Number(len);
    if (Number.isFinite(n) && n > MAX_JSON_BYTES) {
      return jsonError("Solicitud demasiado grande", 413);
    }
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonError("Cuerpo inválido", 400);
  }
  if (raw.length > MAX_JSON_BYTES) {
    return jsonError("Solicitud demasiado grande", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return jsonError("JSON inválido", 400);
  }

  const parsed = leadFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validación", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const email =
    data.email.trim() === "" ? null : data.email.trim().toLowerCase();
  const userAgent = request.headers.get("user-agent");

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({
      ok: true,
      stored: false,
      message:
        "Recibido. Configura la variable FIREBASE_SERVICE_ACCOUNT_KEY para persistir en Firestore.",
    });
  }

  if (email && !leadDedupBypassEmails().has(email)) {
    const existing = await firestore
      .collection("lead_forms")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json({
        ok: true,
        stored: false,
        duplicate: true,
        message:
          "Ese correo ya está registrado para la lista de interés. No reenviamos el correo de agradecimiento para evitar duplicados. Si necesitas actualizar datos, contáctanos por el canal oficial cuando lo publiquemos.",
      });
    }
  }

  const ref = await firestore.collection("lead_forms").add({
    propertyStatusAnswer: data.q1PropertySituation,
    rentalChannelAnswer: data.q2RentalChannel,
    mainConcernAnswer: data.q3MainConcern,
    appInterestAnswer: data.q4LowCostApp,
    q4NoReason: data.q4NoReason ?? null,
    q4NoReasonOther: data.q4NoReasonOther?.trim() || null,
    willingnessToPayAnswer: data.q5WillingToPay,
    mostValuableModuleAnswer: data.q6ValuedModule,
    mostValuableModuleOther: data.q6Other?.trim() || null,
    email,
    contactConsent: data.contactConsent ?? false,
    sourcePage: data.sourcePage,
    userAgent: userAgent ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  let emailNotice: string | undefined;
  if (email) {
    const template = surveyThankYouEmail();
    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      templateCode: "surveyThankYouEmail",
      relatedEntityType: "lead_form",
      relatedEntityId: ref.id,
    });
    if (emailResult.status === "failed") {
      emailNotice =
        "Guardamos tu encuesta, pero el correo de confirmación no se pudo enviar en este momento. Revisa en un rato o en spam y promociones; si sigue sin llegar, contáctanos por el canal oficial cuando lo publiquemos.";
    } else if (emailResult.status === "skipped") {
      emailNotice =
        "Guardamos tu encuesta, pero no enviamos correo (destinatario no válido según nuestros controles).";
    } else if (emailResult.status === "mock") {
      emailNotice =
        "En este entorno el correo no se envía de verdad (no hay RESEND_API_KEY o estás en modo simulado).";
    } else {
      emailNotice =
        "Te enviamos un correo de agradecimiento. Si no lo ves en unos minutos, revisa spam o promociones.";
    }
  } else {
    emailNotice =
      "No indicaste correo electrónico en el formulario (es opcional), así que no enviamos confirmación por e-mail.";
  }

  return NextResponse.json({ ok: true, stored: true, id: ref.id, emailNotice });
}
