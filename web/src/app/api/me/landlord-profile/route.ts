import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { USER_LANDLORD_PROFILES_COLLECTION, sanitizeSavedProfile } from "@/domain/saved-entities/savedEntities";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
    { status: 503 },
  );
}

/** Perfil de arrendador guardado del usuario autenticado (doc por uid). */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const snap = await firestore.collection(USER_LANDLORD_PROFILES_COLLECTION).doc(auth.user.uid).get();
  const profile = snap.exists ? (snap.data()?.profile ?? null) : null;
  return NextResponse.json({ success: true, profile });
}

/** Guarda/actualiza el perfil. El dueño se fija con el uid del token, no del body. */
export async function PUT(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const body = (await request.json().catch(() => null)) as { profile?: unknown } | null;
  const profile = sanitizeSavedProfile(body?.profile);
  if (!profile) {
    return NextResponse.json(
      { success: false, errors: [{ field: "profile", message: "Faltan datos mínimos (nombre y documento)." }] },
      { status: 422 },
    );
  }

  await firestore.collection(USER_LANDLORD_PROFILES_COLLECTION).doc(auth.user.uid).set(
    {
      ownerUid: auth.user.uid,
      ownerEmail: auth.user.email ?? null,
      profile,
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return NextResponse.json({ success: true, profile });
}
