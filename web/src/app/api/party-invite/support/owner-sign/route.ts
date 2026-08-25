import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isPartyRole } from "@/domain/party-invite/partyInvite";
import { validatePaymentSupportFile, sanitizeSupportFileName } from "@/domain/payments/supportValidation";
import { inviteSupportStoragePrefix } from "@/domain/party-invite/inviteSupports";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  contractDraftId: z.string().min(1),
  role: z.string(),
  codebtorSlot: z.number().int().min(0).max(9).optional(),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
});

/**
 * URL firmada para que el DUEÑO (autenticado) suba un documento EN NOMBRE de una
 * parte (inquilino/codeudor) cuando él mismo ingresa los datos (modo self).
 * Escribe en la MISMA carpeta de Storage que los soportes del invitado, para que
 * la lista del dueño los muestre unificados.
 */
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

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPartyRole(parsed.data.role)) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  // Propiedad: solo el dueño del borrador puede subir en nombre de sus partes.
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  const draftSnap = await firestore.collection("contract_drafts").doc(parsed.data.contractDraftId).get();
  if (!draftSnap.exists || (draftSnap.data() as { ownerUid?: string } | undefined)?.ownerUid !== auth.user.uid) {
    return NextResponse.json({ success: false, errors: [{ field: "contractDraftId", message: "No autorizado sobre este borrador." }] }, { status: 403 });
  }

  const v = validatePaymentSupportFile({ supportFileName: parsed.data.filename, supportFileType: parsed.data.contentType, supportFileSize: parsed.data.sizeBytes });
  if (!v.ok) return NextResponse.json({ success: false, errors: v.errors }, { status: 422 });

  const slot = Math.max(0, Math.floor(parsed.data.codebtorSlot ?? 0));
  const objectPath = `${inviteSupportStoragePrefix(parsed.data.contractDraftId, parsed.data.role, slot)}${Date.now()}-${sanitizeSupportFileName(parsed.data.filename)}`;
  const file = getStorage().bucket(bucketName).file(objectPath);
  const expires = Date.now() + 1000 * 60 * 15;
  const [uploadUrl] = await file.getSignedUrl({ version: "v4", action: "write", expires, contentType: parsed.data.contentType });
  return NextResponse.json({ success: true, uploadUrl, storagePath: `gs://${bucketName}/${objectPath}`, expiresAt: new Date(expires).toISOString() });
}
