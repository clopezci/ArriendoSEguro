import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

/** URL firmada de lectura (15 min) del QR de pago, para el dueño (vista previa). */
export async function GET(request: Request) {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Storage no configurado." }] }, { status: 503 });
  }
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const url = new URL(request.url);
  const contractId = url.searchParams.get("contractId") ?? "";
  const storagePath = url.searchParams.get("storagePath") ?? "";
  if (!contractId || !storagePath) {
    return NextResponse.json({ success: false, errors: [{ field: "query", message: "Parámetros incompletos." }] }, { status: 422 });
  }
  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
  if (!participant.ok) return participant.response;

  const expectedPrefix = `gs://${bucketName}/contracts/${contractId}/payment-qr/`;
  if (!storagePath.startsWith(expectedPrefix) || storagePath.includes("..")) {
    return NextResponse.json({ success: false, errors: [{ field: "storagePath", message: "Ruta no válida." }] }, { status: 422 });
  }
  const objectPath = storagePath.slice(`gs://${bucketName}/`.length);
  const file = getStorage().bucket(bucketName).file(objectPath);
  const expires = Date.now() + 1000 * 60 * 15;
  const [downloadUrl] = await file.getSignedUrl({ version: "v4", action: "read", expires });
  return NextResponse.json({ success: true, downloadUrl });
}
