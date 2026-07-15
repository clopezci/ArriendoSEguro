import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { DRAFT_PROPERTY_DOCS_COLLECTION } from "@/domain/contracts/draftPropertyDocs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** URL firmada de lectura de un documento de propiedad, solo para su dueño. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Storage no configurado." }] }, { status: 503 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ success: false, errors: [{ field: "id", message: "Falta el documento." }] }, { status: 422 });

  const doc = await firestore.collection(DRAFT_PROPERTY_DOCS_COLLECTION).doc(id).get();
  const data = doc.data() as { ownerUid?: string; storagePath?: string; fileName?: string } | undefined;
  if (!doc.exists || !data || data.ownerUid !== auth.user.uid) {
    return NextResponse.json({ success: false, errors: [{ field: "id", message: "No encontrado." }] }, { status: 404 });
  }

  const gsPrefix = `gs://${bucketName}/`;
  const objectPath = (data.storagePath ?? "").startsWith(gsPrefix) ? (data.storagePath ?? "").slice(gsPrefix.length) : "";
  if (!objectPath) return NextResponse.json({ success: false, errors: [{ field: "id", message: "Ruta inválida." }] }, { status: 422 });

  const file = getStorage().bucket(bucketName).file(objectPath);
  const expires = Date.now() + 1000 * 60 * 10;
  const [downloadUrl] = await file.getSignedUrl({ version: "v4", action: "read", expires });
  return NextResponse.json({ success: true, downloadUrl, fileName: data.fileName ?? "documento" });
}
