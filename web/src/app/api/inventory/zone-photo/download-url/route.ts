import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** URL firmada de lectura para mostrar una miniatura de foto de inventario. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Storage no configurado." }] }, { status: 503 });
  }
  const storagePath = new URL(request.url).searchParams.get("storagePath") ?? "";
  const prefix = `gs://${bucketName}/inventories/`;
  if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
    return NextResponse.json({ success: false, errors: [{ field: "storagePath", message: "Ruta inválida." }] }, { status: 422 });
  }
  const objectPath = storagePath.slice(`gs://${bucketName}/`.length);
  const [downloadUrl] = await getStorage()
    .bucket(bucketName)
    .file(objectPath)
    .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 1000 * 60 * 20 });
  return NextResponse.json({ success: true, downloadUrl });
}
