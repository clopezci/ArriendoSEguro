import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isPartyRole } from "@/domain/party-invite/partyInvite";
import { validatePaymentSupportFile, sanitizeSupportFileName, isAllowedSupportMagic } from "@/domain/payments/supportValidation";
import { PARTY_INVITE_SUPPORTS_COLLECTION, PARTY_INVITE_SUPPORT_MAX_PER_PARTY, inviteSupportStoragePrefix } from "@/domain/party-invite/inviteSupports";

export const runtime = "nodejs";

/**
 * Subida DIRECTA (proxy) del DUEÑO en nombre de una parte (inquilino/codeudor)
 * cuando él mismo ingresa los datos. El navegador envía el archivo a NUESTRA API
 * (same-origin, sin URL firmada ni CORS) y el servidor lo guarda con el Admin
 * SDK. Reemplaza owner-sign→PUT→owner-submit para evitar el "error de red" del
 * PUT del navegador contra Storage. Siempre responde JSON.
 */
const MAX_BYTES = 5 * 1024 * 1024;

function err(message: string, status = 422, field = "body") {
  return NextResponse.json({ success: false, errors: [{ field, message }] }, { status });
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) return err("Storage no configurado.", 503, "server");
    const firestore = getAdminFirestore();
    if (!firestore) return err("Firestore no configurado.", 503, "server");

    const url = new URL(request.url);
    const contractDraftId = url.searchParams.get("contractDraftId") ?? "";
    const role = url.searchParams.get("role") ?? "";
    const slot = Math.max(0, Math.floor(Number(url.searchParams.get("codebtorSlot") ?? "0") || 0));
    const docKey = url.searchParams.get("docKey") ?? "";
    const filename = url.searchParams.get("filename") ?? "documento";
    const contentType = url.searchParams.get("contentType") || request.headers.get("content-type") || "application/octet-stream";
    if (!contractDraftId || !isPartyRole(role)) return err("Datos inválidos.");

    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) return err("El archivo llegó vacío. Intenta de nuevo.");
    if (buf.length > MAX_BYTES) return err("El archivo supera el máximo de 5 MB.");

    const v = validatePaymentSupportFile({ supportFileName: filename, supportFileType: contentType, supportFileSize: buf.length });
    if (!v.ok) return NextResponse.json({ success: false, errors: v.errors }, { status: 422 });
    if (!isAllowedSupportMagic(new Uint8Array(buf.subarray(0, 16)))) {
      return err("El archivo no es un documento válido (PDF/JPG/PNG/WEBP).", 422, "file");
    }

    // Límite por parte (comparte cupo con lo que suba el invitado).
    const existing = await firestore
      .collection(PARTY_INVITE_SUPPORTS_COLLECTION)
      .where("contractDraftId", "==", contractDraftId)
      .where("role", "==", role)
      .limit(PARTY_INVITE_SUPPORT_MAX_PER_PARTY + 1)
      .get()
      .catch(() => null);
    if (existing && existing.size >= PARTY_INVITE_SUPPORT_MAX_PER_PARTY) {
      return err(`Máximo ${PARTY_INVITE_SUPPORT_MAX_PER_PARTY} documentos.`, 422, "limit");
    }

    const objectPath = `${inviteSupportStoragePrefix(contractDraftId, role, slot)}${Date.now()}-${sanitizeSupportFileName(filename)}`;
    const storagePath = `gs://${bucketName}/${objectPath}`;
    await getStorage().bucket(bucketName).file(objectPath).save(buf, { contentType, resumable: false, metadata: { contentType } });

    const now = new Date().toISOString();
    const ref = firestore.collection(PARTY_INVITE_SUPPORTS_COLLECTION).doc();
    await ref.set({
      id: ref.id,
      contractDraftId,
      role,
      codebtorSlot: slot,
      inviterUid: auth.user.uid,
      inviteToken: null,
      uploadedByName: "El arrendador (en nombre de la parte)",
      ...(docKey ? { docKey } : {}),
      storagePath,
      fileName: filename,
      contentType,
      sizeBytes: buf.length,
      uploadedAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id });
  } catch (e) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo subir el documento en el servidor." }], detail: e instanceof Error ? e.message.slice(0, 200) : "error" },
      { status: 500 },
    );
  }
}
