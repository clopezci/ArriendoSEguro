import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isPartyRole } from "@/domain/party-invite/partyInvite";
import { isAllowedSupportMagic } from "@/domain/payments/supportValidation";
import { PARTY_INVITE_SUPPORTS_COLLECTION, PARTY_INVITE_SUPPORT_MAX_PER_PARTY, inviteSupportStoragePrefix } from "@/domain/party-invite/inviteSupports";

export const runtime = "nodejs";

const schema = z.object({
  contractDraftId: z.string().min(1),
  role: z.string(),
  codebtorSlot: z.number().int().min(0).max(9).optional(),
  storagePath: z.string().min(8),
  fileName: z.string().max(200).optional(),
  contentType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  docKey: z.string().max(60).optional(),
});

/** El DUEÑO confirma la subida de un documento en nombre de una parte (magic bytes). */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !isPartyRole(parsed.data.role)) {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
  }

  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const slot = Math.max(0, Math.floor(parsed.data.codebtorSlot ?? 0));
  const expectedPrefix = `gs://${bucketName}/${inviteSupportStoragePrefix(parsed.data.contractDraftId, parsed.data.role, slot)}`;
  const remainder = parsed.data.storagePath.startsWith(expectedPrefix) ? parsed.data.storagePath.slice(expectedPrefix.length) : null;
  if (!remainder || remainder.includes("/") || remainder.includes("..")) {
    return NextResponse.json({ success: false, errors: [{ field: "storagePath", message: "Documento no válido." }] }, { status: 422 });
  }

  // Límite por parte (comparte cupo con lo que suba el invitado).
  const existing = await firestore
    .collection(PARTY_INVITE_SUPPORTS_COLLECTION)
    .where("contractDraftId", "==", parsed.data.contractDraftId)
    .where("role", "==", parsed.data.role)
    .limit(PARTY_INVITE_SUPPORT_MAX_PER_PARTY + 1)
    .get()
    .catch(() => null);
  if (existing && existing.size >= PARTY_INVITE_SUPPORT_MAX_PER_PARTY) {
    return NextResponse.json({ success: false, errors: [{ field: "limit", message: `Máximo ${PARTY_INVITE_SUPPORT_MAX_PER_PARTY} documentos.` }] }, { status: 422 });
  }

  if (bucketName) {
    try {
      const objectPath = `${inviteSupportStoragePrefix(parsed.data.contractDraftId, parsed.data.role, slot)}${remainder}`;
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
  const ref = firestore.collection(PARTY_INVITE_SUPPORTS_COLLECTION).doc();
  await ref.set({
    id: ref.id,
    contractDraftId: parsed.data.contractDraftId,
    role: parsed.data.role,
    codebtorSlot: slot,
    inviterUid: auth.user.uid, // el dueño: para que aparezca en su propia lista
    inviteToken: null,
    uploadedByName: "El arrendador (en nombre de la parte)",
    ...(parsed.data.docKey ? { docKey: parsed.data.docKey } : {}),
    storagePath: parsed.data.storagePath,
    fileName: parsed.data.fileName ?? "documento",
    contentType: parsed.data.contentType ?? "",
    sizeBytes: Number(parsed.data.sizeBytes) || 0,
    uploadedAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, id: ref.id });
}
