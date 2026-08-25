import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  requireInternalAdmin,
  getStoredAdminEmails,
  INTERNAL_ADMINS_COLLECTION,
  INTERNAL_ADMINS_DOC_ID,
} from "@/lib/admin/internal-admin";
import { FOUNDER_ADMIN_EMAILS } from "@/lib/admin/founder-admins";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email("Correo inválido.").max(160) });

function envAdmins(): string[] {
  return (process.env.ADMIN_INTERNAL_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Lista de administradores por fuente (fundadores/entorno = no removibles). */
export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const stored = await getStoredAdminEmails();
  return NextResponse.json({
    success: true,
    founders: [...FOUNDER_ADMIN_EMAILS],
    envAdmins: envAdmins(),
    stored,
    you: auth.user.email.toLowerCase(),
  });
}

/** Agrega un administrador (a la lista guardada en Firestore). */
export async function POST(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }
  const email = parsed.data.email;

  if (FOUNDER_ADMIN_EMAILS.includes(email) || envAdmins().includes(email)) {
    return NextResponse.json(
      { success: false, errors: [{ field: "email", message: "Ese correo ya es administrador (fundador o por configuración)." }] },
      { status: 409 },
    );
  }

  await firestore
    .collection(INTERNAL_ADMINS_COLLECTION)
    .doc(INTERNAL_ADMINS_DOC_ID)
    .set(
      { emails: FieldValue.arrayUnion(email), updatedAt: FieldValue.serverTimestamp(), updatedBy: auth.user.email.toLowerCase() },
      { merge: true },
    );

  return NextResponse.json({ success: true, email });
}

/** Quita un administrador de la lista guardada (fundadores/entorno no se pueden). */
export async function DELETE(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ success: false, errors: [{ field: "email", message: "Falta el correo." }] }, { status: 422 });
  }
  if (FOUNDER_ADMIN_EMAILS.includes(email) || envAdmins().includes(email)) {
    return NextResponse.json(
      {
        success: false,
        errors: [{ field: "email", message: "Ese admin es fundador o está por configuración del servidor; no se puede quitar desde aquí." }],
      },
      { status: 409 },
    );
  }

  await firestore
    .collection(INTERNAL_ADMINS_COLLECTION)
    .doc(INTERNAL_ADMINS_DOC_ID)
    .set(
      { emails: FieldValue.arrayRemove(email), updatedAt: FieldValue.serverTimestamp(), updatedBy: auth.user.email.toLowerCase() },
      { merge: true },
    );

  return NextResponse.json({ success: true, email });
}
