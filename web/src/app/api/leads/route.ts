import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { leadFormSchema } from "@/lib/validations/lead-form";
import { getAdminFirestore } from "@/lib/firebase/admin";

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
    q1: data.q1PropertySituation,
    q2: data.q2RentalChannel,
    q3: data.q3MainConcern,
    q4: data.q4LowCostApp,
    q4NoReason: data.q4NoReason ?? null,
    q4NoReasonOther: data.q4NoReasonOther?.trim() || null,
    q5: data.q5WillingToPay,
    q6: data.q6ValuedModule,
    email,
    contactConsent: data.contactConsent ?? false,
    source: "landing",
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, stored: true, id: ref.id });
}
