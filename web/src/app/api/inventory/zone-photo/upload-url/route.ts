import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { requireInventoryParticipant } from "@/lib/auth/requireInventoryParticipant";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

const schema = z.object({
  inventoryId: z.string().min(3),
  selectedZoneId: z.string().min(1),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
});

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/** URL firmada para subir una foto de una zona del inventario. */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Storage no configurado." }] }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }
  if (!ALLOWED.includes(parsed.data.contentType)) {
    return NextResponse.json({ success: false, errors: [{ field: "contentType", message: "La foto debe ser JPG, PNG o WEBP." }] }, { status: 422 });
  }

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const gate = await requireInventoryParticipant(request, firestore, parsed.data.inventoryId);
  if (!gate.ok) return gate.response;

  const objectPath = `inventories/${parsed.data.inventoryId}/zones/${sanitize(parsed.data.selectedZoneId)}/${Date.now()}-${sanitize(parsed.data.filename)}`;
  const file = getStorage().bucket(bucketName).file(objectPath);
  const expires = Date.now() + 1000 * 60 * 15;
  const [uploadUrl] = await file.getSignedUrl({ version: "v4", action: "write", expires, contentType: parsed.data.contentType });

  return NextResponse.json({ success: true, uploadUrl, storagePath: `gs://${bucketName}/${objectPath}`, expiresAt: new Date(expires).toISOString() });
}
