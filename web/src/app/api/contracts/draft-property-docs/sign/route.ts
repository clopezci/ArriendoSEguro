import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { validatePaymentSupportFile, sanitizeSupportFileName } from "@/domain/payments/supportValidation";
import { draftPropertyDocPrefix, isPropertyDocType } from "@/domain/contracts/draftPropertyDocs";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  contractDraftId: z.string().min(1),
  docType: z.string().min(2),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
});

/** URL firmada para que el DUEÑO suba un documento de propiedad del borrador. */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.signatureOtp);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Storage no configurado." }] }, { status: 503 });
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPropertyDocType(parsed.data.docType)) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  // Propiedad: solo el dueño del borrador puede firmar una URL de escritura en su carpeta.
  const draftSnap = await firestore.collection("contract_drafts").doc(parsed.data.contractDraftId).get();
  if (!draftSnap.exists || (draftSnap.data() as { ownerUid?: string } | undefined)?.ownerUid !== auth.user.uid) {
    return NextResponse.json({ success: false, errors: [{ field: "contractDraftId", message: "No autorizado sobre este borrador." }] }, { status: 403 });
  }

  const v = validatePaymentSupportFile({ supportFileName: parsed.data.filename, supportFileType: parsed.data.contentType, supportFileSize: parsed.data.sizeBytes });
  if (!v.ok) return NextResponse.json({ success: false, errors: v.errors }, { status: 422 });

  const objectPath = `${draftPropertyDocPrefix(parsed.data.contractDraftId)}${Date.now()}-${sanitizeSupportFileName(parsed.data.filename)}`;
  const file = getStorage().bucket(bucketName).file(objectPath);
  const expires = Date.now() + 1000 * 60 * 15;
  const [uploadUrl] = await file.getSignedUrl({ version: "v4", action: "write", expires, contentType: parsed.data.contentType });
  return NextResponse.json({ success: true, uploadUrl, storagePath: `gs://${bucketName}/${objectPath}`, expiresAt: new Date(expires).toISOString() });
}
