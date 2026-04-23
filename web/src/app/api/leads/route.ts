import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { leadFormSchema } from "@/lib/validations/lead-form";
import { getAdminFirestore } from "@/lib/firebase/admin";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Cuerpo inválido", 400);
  }

  const parsed = leadFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validación", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const email = data.email.trim() === "" ? null : data.email.trim();

  const firestore = getAdminFirestore();
  if (!firestore) {
    // Sin credenciales: respuesta de desarrollo. Configura FIREBASE_SERVICE_ACCOUNT_KEY en Vercel.
    return NextResponse.json({
      ok: true,
      stored: false,
      message:
        "Recibido. Configura la variable FIREBASE_SERVICE_ACCOUNT_KEY para persistir en Firestore.",
    });
  }

  const ref = await firestore.collection("lead_forms").add({
    q1: data.q1PropertySituation,
    q2: data.q2RentalChannel,
    q3: data.q3MainConcern,
    q4: data.q4LowCostApp,
    q5: data.q5WillingToPay,
    q6: data.q6ValuedModule,
    email,
    contactConsent: data.contactConsent ?? false,
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, stored: true, id: ref.id });
}
