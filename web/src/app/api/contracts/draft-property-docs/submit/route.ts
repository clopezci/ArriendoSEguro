import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isAllowedSupportMagic } from "@/domain/payments/supportValidation";
import { DRAFT_PROPERTY_DOCS_COLLECTION, DRAFT_PROPERTY_DOC_MAX, draftPropertyDocPrefix, isPropertyDocType } from "@/domain/contracts/draftPropertyDocs";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  contractDraftId: z.string().min(1),
  docType: z.string().min(2),
  storagePath: z.string().min(8),
  fileName: z.string().max(200).optional(),
  contentType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

/** El DUEÑO confirma la subida de un documento de propiedad (verifica magic bytes). */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.signatureOtp);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPropertyDocType(parsed.data.docType)) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const expectedPrefix = `gs://${bucketName}/${draftPropertyDocPrefix(parsed.data.contractDraftId)}`;
  const remainder = parsed.data.storagePath.startsWith(expectedPrefix) ? parsed.data.storagePath.slice(expectedPrefix.length) : null;
  if (!remainder || remainder.includes("/") || remainder.includes("..")) {
    return NextResponse.json({ success: false, errors: [{ field: "storagePath", message: "Documento no válido." }] }, { status: 422 });
  }

  // Límite por borrador.
  const existing = await firestore
    .collection(DRAFT_PROPERTY_DOCS_COLLECTION)
    .where("contractDraftId", "==", parsed.data.contractDraftId)
    .where("ownerUid", "==", auth.user.uid)
    .limit(DRAFT_PROPERTY_DOC_MAX + 1)
    .get()
    .catch(() => null);
  if (existing && existing.size >= DRAFT_PROPERTY_DOC_MAX) {
    return NextResponse.json({ success: false, errors: [{ field: "limit", message: `Máximo ${DRAFT_PROPERTY_DOC_MAX} documentos.` }] }, { status: 422 });
  }

  // Verificación de magic bytes.
  if (bucketName) {
    try {
      const objectPath = `${draftPropertyDocPrefix(parsed.data.contractDraftId)}${remainder}`;
      const fileRef = getStorage().bucket(bucketName).file(objectPath);
      const [head] = await fileRef.download({ start: 0, end: 15 });
      if (!isAllowedSupportMagic(new Uint8Array(head))) {
        await fileRef.delete().catch(() => {});
        return NextResponse.json({ success: false, errors: [{ field: "storagePath", message: "El archivo no es un documento válido (PDF/JPG/PNG/WEBP)." }] }, { status: 422 });
      }
    } catch {
      return NextResponse.json({ success: false, errors: [{ field: "storagePath", message: "No se pudo verificar el documento subido." }] }, { status: 422 });
    }
  }

  const now = new Date().toISOString();
  const ref = firestore.collection(DRAFT_PROPERTY_DOCS_COLLECTION).doc();
  await ref.set({
    id: ref.id,
    contractDraftId: parsed.data.contractDraftId,
    ownerUid: auth.user.uid,
    docType: parsed.data.docType,
    storagePath: parsed.data.storagePath,
    fileName: parsed.data.fileName ?? "documento",
    contentType: parsed.data.contentType ?? "",
    sizeBytes: Number(parsed.data.sizeBytes) || 0,
    uploadedAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, id: ref.id });
}
