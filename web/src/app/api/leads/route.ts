import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { leadFormSchema } from "@/lib/validations/lead-form";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { surveyThankYouEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";

export const runtime = "nodejs";

const MAX_JSON_BYTES = 32_000;

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
 * y evita duplicar por el mismo correo (cuando el usuario lo informa).
 * Abuso: mitigar más adelante con rate limit (Edge/KV) o reglas de red en Vercel.
 */
export async function POST(request: Request) {
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

  if (email) {
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
          "Ese correo ya está registrado para la lista de interés. Si necesitas actualizar datos, contáctanos por el canal oficial cuando lo publiquemos.",
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

  if (email) {
    const template = surveyThankYouEmail();
    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
      templateCode: "surveyThankYouEmail",
      relatedEntityType: "lead_form",
      relatedEntityId: ref.id,
    });
  }

  return NextResponse.json({ ok: true, stored: true, id: ref.id });
}
