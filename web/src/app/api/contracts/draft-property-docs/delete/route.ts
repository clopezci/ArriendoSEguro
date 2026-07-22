import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { DRAFT_PROPERTY_DOCS_COLLECTION } from "@/domain/contracts/draftPropertyDocs";

export const runtime = "nodejs";

/**
 * Borra un documento de propiedad/poder del borrador: elimina el objeto en
 * Storage y su registro en Firestore. Solo el dueño del documento
 * (ownerUid == usuario autenticado) puede borrarlo. Idempotente.
 */
function err(message: string, status = 422, field = "body") {
  return NextResponse.json({ success: false, errors: [{ field, message }] }, { status });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const firestore = getAdminFirestore();
    if (!firestore) return err("Firestore no configurado.", 503, "server");

    const body = (await request.json().catch(() => ({}))) as { id?: string };
    const id = (body.id ?? "").trim();
    if (!id) return err("Falta el identificador del documento.");

    const ref = firestore.collection(DRAFT_PROPERTY_DOCS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ success: true, deleted: false });

    const data = snap.data() as { ownerUid?: string; storagePath?: string };
    if (data.ownerUid !== auth.user.uid) {
      return err("No autorizado para borrar este documento.", 403, "auth");
    }

    // Borra el objeto en Storage (best-effort: si ya no existe, seguimos).
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    const gsPrefix = bucketName ? `gs://${bucketName}/` : "";
    const objectPath = gsPrefix && (data.storagePath ?? "").startsWith(gsPrefix)
      ? (data.storagePath ?? "").slice(gsPrefix.length)
      : "";
    if (bucketName && objectPath) {
      await getStorage().bucket(bucketName).file(objectPath).delete().catch(() => {});
    }

    await ref.delete();
    return NextResponse.json({ success: true, deleted: true });
  } catch {
    return err("No se pudo borrar el documento.", 500, "server");
  }
}
