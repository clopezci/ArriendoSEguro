import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  PARTNERS_COLLECTION,
  validatePartnerInput,
  seedTestPartners,
} from "@/domain/partners/partners";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
    { status: 503 },
  );
}

/** Lista todos los aliados (con correos, solo para admin). Siembra de prueba si está vacío. */
export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const col = firestore.collection(PARTNERS_COLLECTION);
  const PAGE_LIMIT = 1000;
  let snap = await col.limit(PAGE_LIMIT).get();
  if (snap.empty) {
    // Siembra aliados de prueba editables, con tu correo como contacto.
    const now = new Date().toISOString();
    const batch = firestore.batch();
    for (const p of seedTestPartners(auth.user.email)) {
      const ref = col.doc();
      batch.set(ref, { ...p, isSeed: true, createdAt: now, createdAtServer: FieldValue.serverTimestamp() });
    }
    await batch.commit();
    snap = await col.limit(PAGE_LIMIT).get();
  }

  const partners = snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      name: String(x.name ?? ""),
      category: String(x.category ?? "otro"),
      description: String(x.description ?? ""),
      websiteUrl: String(x.websiteUrl ?? ""),
      contactEmails: (x.contactEmails as string[]) ?? [],
      active: Boolean(x.active),
    };
  });
  return NextResponse.json({ success: true, partners });
}

/** Crea un aliado. */
export async function POST(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const body = await request.json().catch(() => null);
  const v = validatePartnerInput((body ?? {}) as Record<string, unknown>);
  if (!v.ok) return NextResponse.json({ success: false, errors: [{ field: "partner", message: v.message }] }, { status: 422 });

  const ref = firestore.collection(PARTNERS_COLLECTION).doc();
  await ref.set({ ...v.value, createdAt: new Date().toISOString(), createdAtServer: FieldValue.serverTimestamp() });
  return NextResponse.json({ success: true, id: ref.id });
}

/** Actualiza un aliado existente (incluye activar/desactivar). */
export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ success: false, errors: [{ field: "id", message: "Falta el id." }] }, { status: 422 });

  const v = validatePartnerInput(body ?? {});
  if (!v.ok) return NextResponse.json({ success: false, errors: [{ field: "partner", message: v.message }] }, { status: 422 });

  await firestore.collection(PARTNERS_COLLECTION).doc(id).set(
    { ...v.value, updatedAt: new Date().toISOString(), updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return NextResponse.json({ success: true });
}

/** Elimina un aliado. */
export async function DELETE(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ success: false, errors: [{ field: "id", message: "Falta el id." }] }, { status: 422 });
  await firestore.collection(PARTNERS_COLLECTION).doc(id).delete();
  return NextResponse.json({ success: true });
}
