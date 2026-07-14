import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import { isInviteOpenForUpload } from "@/domain/party-invite/partyInvite";
import { validatePaymentSupportFile, sanitizeSupportFileName } from "@/domain/payments/supportValidation";
import { inviteSupportStoragePrefix } from "@/domain/party-invite/inviteSupports";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(8),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
});

/** URL firmada para que el invitado (inquilino/codeudor) suba un documento. */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  if (!bucketName) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Storage no configurado." }] }, { status: 503 });
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });

  const invite = await getInvite(firestore, parsed.data.token);
  if (!isInviteOpenForUpload(invite, Date.now()) || !invite) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "El enlace no es válido o expiró." }] }, { status: 410 });
  }
  if (!invite.otpVerifiedAt) {
    return NextResponse.json({ success: false, errors: [{ field: "otp", message: "Valida primero tu identidad con el código." }] }, { status: 403 });
  }

  const v = validatePaymentSupportFile({ supportFileName: parsed.data.filename, supportFileType: parsed.data.contentType, supportFileSize: parsed.data.sizeBytes });
  if (!v.ok) return NextResponse.json({ success: false, errors: v.errors }, { status: 422 });

  const objectPath = `${inviteSupportStoragePrefix(invite.contractDraftId, invite.role)}${Date.now()}-${sanitizeSupportFileName(parsed.data.filename)}`;
  const file = getStorage().bucket(bucketName).file(objectPath);
  const expires = Date.now() + 1000 * 60 * 15;
  const [uploadUrl] = await file.getSignedUrl({ version: "v4", action: "write", expires, contentType: parsed.data.contentType });
  return NextResponse.json({ success: true, uploadUrl, storagePath: `gs://${bucketName}/${objectPath}`, expiresAt: new Date(expires).toISOString() });
}
