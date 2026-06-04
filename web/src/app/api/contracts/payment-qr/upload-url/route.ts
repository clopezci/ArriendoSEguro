import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { sanitizeSupportFileName } from "@/domain/payments/supportValidation";

export const runtime = "nodejs";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
type Err = { success: false; errors: { field: string; message: string }[] };

const schema = z.object({
  contractId: z.string().min(3),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

/** URL firmada para subir la imagen del QR de pago (solo el arrendador). */
export async function POST(request: Request) {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "server", message: "Storage no configurado." }] }, { status: 503 });
  }
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json<Err>({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }
  if (!ALLOWED.includes(parsed.data.contentType)) {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "contentType", message: "El QR debe ser PNG, JPG o WEBP." }] }, { status: 422 });
  }
  const participant = await requireContractParticipant(request, firestore, parsed.data.contractId, { kind: "current" });
  if (!participant.ok) return participant.response;
  if (participant.role !== "landlord") {
    return NextResponse.json<Err>({ success: false, errors: [{ field: "auth", message: "Solo el arrendador puede subir el QR." }] }, { status: 403 });
  }

  const objectPath = `contracts/${parsed.data.contractId}/payment-qr/${Date.now()}-${sanitizeSupportFileName(parsed.data.filename)}`;
  const file = getStorage().bucket(bucketName).file(objectPath);
  const expires = Date.now() + 1000 * 60 * 15;
  const [uploadUrl] = await file.getSignedUrl({ version: "v4", action: "write", expires, contentType: parsed.data.contentType });
  auditEvent("payment_qr_upload_url_issued", { contractId: parsed.data.contractId });
  return NextResponse.json({ success: true, uploadUrl, storagePath: `gs://${bucketName}/${objectPath}`, expiresAt: new Date(expires).toISOString() });
}
