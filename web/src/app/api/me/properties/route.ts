import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import {
  USER_PROPERTIES_COLLECTION,
  sanitizeSavedPropertyData,
  sanitizePropertyLabel,
} from "@/domain/saved-entities/savedEntities";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
    { status: 503 },
  );
}

/** Lista los inmuebles guardados del usuario autenticado. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const snap = await firestore
    .collection(USER_PROPERTIES_COLLECTION)
    .where("ownerUid", "==", auth.user.uid)
    .limit(200)
    .get();

  const properties = snap.docs.map((d) => {
    const x = d.data() as { label?: string; property?: unknown; updatedAt?: string };
    return { id: d.id, label: x.label ?? "Inmueble", property: x.property ?? {}, updatedAt: x.updatedAt ?? null };
  });
  return NextResponse.json({ success: true, properties });
}

/** Guarda un inmueble nuevo (ownerUid del token). */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const body = (await request.json().catch(() => null)) as { label?: unknown; property?: unknown } | null;
  const property = sanitizeSavedPropertyData(body?.property);
  if (!property.address && !property.addressParts) {
    return NextResponse.json(
      { success: false, errors: [{ field: "property", message: "El inmueble necesita al menos una dirección." }] },
      { status: 422 },
    );
  }
  const label = sanitizePropertyLabel(body?.label, property);
  const nowIso = new Date().toISOString();
  const ref = firestore.collection(USER_PROPERTIES_COLLECTION).doc();
  await ref.set({
    id: ref.id,
    ownerUid: auth.user.uid,
    ownerEmail: auth.user.email ?? null,
    label,
    property,
    updatedAt: nowIso,
    createdAtServer: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ success: true, id: ref.id, label });
}

/** Borra un inmueble guardado (solo si es del usuario). */
export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, errors: [{ field: "id", message: "Falta el id." }] }, { status: 422 });
  }
  const ref = firestore.collection(USER_PROPERTIES_COLLECTION).doc(id);
  const snap = await ref.get();
  if (snap.exists && (snap.data() as { ownerUid?: string }).ownerUid === auth.user.uid) {
    await ref.delete();
  }
  // Idempotente y sin filtrar info de otros usuarios.
  return NextResponse.json({ success: true });
}
