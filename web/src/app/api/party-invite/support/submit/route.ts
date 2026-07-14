import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import { isInviteOpenForUpload } from "@/domain/party-invite/partyInvite";
import { isAllowedSupportMagic } from "@/domain/payments/supportValidation";
import { PARTY_INVITE_SUPPORTS_COLLECTION, PARTY_INVITE_SUPPORT_MAX_PER_PARTY, inviteSupportStoragePrefix } from "@/domain/party-invite/inviteSupports";
import { auditEvent } from "@/features/contracts/audit-server";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(8),
  storagePath: z.string().min(8),
  fileName: z.string().max(200).optional(),
  contentType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

/** El invitado confirma la subida de un documento (verificación de magic bytes). */
export async function POST(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
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

  // La ruta debe estar DIRECTAMENTE en la carpeta de soportes de ESTA parte de
  // ESTE contrato (un solo segmento tras el prefijo, sin subrutas ni traversal).
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const slot = invite.codebtorSlot ?? 0;
  const expectedPrefix = `gs://${bucketName}/${inviteSupportStoragePrefix(invite.contractDraftId, invite.role, slot)}`;
  const remainder = parsed.data.storagePath.startsWith(expectedPrefix)
    ? parsed.data.storagePath.slice(expectedPrefix.length)
    : null;
  if (!remainder || remainder.includes("/") || remainder.includes("..")) {
    return NextResponse.json({ success: false, errors: [{ field: "storagePath", message: "Documento no válido." }] }, { status: 422 });
  }

  // Límite por parte.
  const existing = await firestore
    .collection(PARTY_INVITE_SUPPORTS_COLLECTION)
    .where("contractDraftId", "==", invite.contractDraftId)
    .where("role", "==", invite.role)
    .limit(PARTY_INVITE_SUPPORT_MAX_PER_PARTY + 1)
    .get()
    .catch(() => null);
  if (existing && existing.size >= PARTY_INVITE_SUPPORT_MAX_PER_PARTY) {
    return NextResponse.json({ success: false, errors: [{ field: "limit", message: `Máximo ${PARTY_INVITE_SUPPORT_MAX_PER_PARTY} documentos.` }] }, { status: 422 });
  }

  // Verificación de magic bytes: descargamos la cabecera real y confirmamos
  // PDF/JPG/PNG/WEBP. Si no coincide, borramos el objeto y rechazamos.
  if (bucketName) {
    try {
      const objectPath = `${inviteSupportStoragePrefix(invite.contractDraftId, invite.role, slot)}${remainder}`;
      const fileRef = getStorage().bucket(bucketName).file(objectPath);
      const [head] = await fileRef.download({ start: 0, end: 15 });
      if (!isAllowedSupportMagic(new Uint8Array(head))) {
        await fileRef.delete().catch(() => {});
        return NextResponse.json(
          { success: false, errors: [{ field: "storagePath", message: "El archivo no es un documento válido (PDF/JPG/PNG/WEBP)." }] },
          { status: 422 },
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, errors: [{ field: "storagePath", message: "No se pudo verificar el documento subido." }] },
        { status: 422 },
      );
    }
  }

  const now = new Date().toISOString();
  const ref = firestore.collection(PARTY_INVITE_SUPPORTS_COLLECTION).doc();
  await ref.set({
    id: ref.id,
    contractDraftId: invite.contractDraftId,
    role: invite.role,
    codebtorSlot: slot, // para separar documentos de varios codeudores
    inviterUid: invite.inviterUid, // el dueño: para que él los vea y descargue
    inviteToken: invite.token,
    uploadedByName: invite.contribution?.fullName || invite.inviteeName || "",
    storagePath: parsed.data.storagePath,
    fileName: parsed.data.fileName ?? "documento",
    contentType: parsed.data.contentType ?? "",
    sizeBytes: Number(parsed.data.sizeBytes) || 0,
    uploadedAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });

  auditEvent("invite_support_uploaded", { contractId: invite.contractDraftId, role: invite.role });
  return NextResponse.json({ success: true, id: ref.id });
}
