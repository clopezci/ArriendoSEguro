import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import { isInviteOpenForUpload } from "@/domain/party-invite/partyInvite";
import { validatePaymentSupportFile, sanitizeSupportFileName, isAllowedSupportMagic } from "@/domain/payments/supportValidation";
import { PARTY_INVITE_SUPPORTS_COLLECTION, PARTY_INVITE_SUPPORT_MAX_PER_PARTY, inviteSupportStoragePrefix } from "@/domain/party-invite/inviteSupports";
import { auditEvent } from "@/features/contracts/audit-server";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Subida DIRECTA (proxy) del INVITADO (inquilino/codeudor) desde su enlace: el
 * navegador envía el archivo a NUESTRA API (same-origin, sin URL firmada ni
 * CORS) y el servidor lo guarda con el Admin SDK. Reemplaza sign→PUT→submit para
 * evitar el "error de red" del PUT del navegador contra Storage. Requiere OTP
 * verificado (igual que el resto del enlace). Siempre responde JSON.
 */
const MAX_BYTES = 5 * 1024 * 1024;

function err(message: string, status = 422, field = "body") {
  return NextResponse.json({ success: false, errors: [{ field, message }] }, { status });
}

export async function POST(request: Request) {
  try {
    const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
    if (!rl.ok) {
      const t = tooManyRequestsJson(rl.retryAfterSeconds);
      return NextResponse.json(t.body, { status: 429, headers: t.headers });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return err("Firestore no configurado.", 503, "server");
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) return err("Storage no configurado.", 503, "server");

    const url = new URL(request.url);
    const token = url.searchParams.get("token") ?? "";
    const docKey = url.searchParams.get("docKey") ?? "";
    const filename = url.searchParams.get("filename") ?? "documento";
    const contentType = url.searchParams.get("contentType") || request.headers.get("content-type") || "application/octet-stream";

    const invite = await getInvite(firestore, token);
    if (!invite || !isInviteOpenForUpload(invite, Date.now())) {
      return err("El enlace no es válido o expiró.", 410, "token");
    }
    if (!invite.otpVerifiedAt) return err("Valida primero tu identidad con el código.", 403, "otp");

    const buf = Buffer.from(await request.arrayBuffer());
    if (buf.length === 0) return err("El archivo llegó vacío. Intenta de nuevo.");
    if (buf.length > MAX_BYTES) return err("El archivo supera el máximo de 5 MB.");

    const v = validatePaymentSupportFile({ supportFileName: filename, supportFileType: contentType, supportFileSize: buf.length });
    if (!v.ok) return NextResponse.json({ success: false, errors: v.errors }, { status: 422 });
    if (!isAllowedSupportMagic(new Uint8Array(buf.subarray(0, 16)))) {
      return err("El archivo no es un documento válido (PDF/JPG/PNG/WEBP).", 422, "file");
    }

    const slot = invite.codebtorSlot ?? 0;
    const existing = await firestore
      .collection(PARTY_INVITE_SUPPORTS_COLLECTION)
      .where("contractDraftId", "==", invite.contractDraftId)
      .where("role", "==", invite.role)
      .limit(PARTY_INVITE_SUPPORT_MAX_PER_PARTY + 1)
      .get()
      .catch(() => null);
    if (existing && existing.size >= PARTY_INVITE_SUPPORT_MAX_PER_PARTY) {
      return err(`Máximo ${PARTY_INVITE_SUPPORT_MAX_PER_PARTY} documentos.`, 422, "limit");
    }

    const objectPath = `${inviteSupportStoragePrefix(invite.contractDraftId, invite.role, slot)}${Date.now()}-${sanitizeSupportFileName(filename)}`;
    const storagePath = `gs://${bucketName}/${objectPath}`;
    await getStorage().bucket(bucketName).file(objectPath).save(buf, { contentType, resumable: false, metadata: { contentType } });

    const now = new Date().toISOString();
    const ref = firestore.collection(PARTY_INVITE_SUPPORTS_COLLECTION).doc();
    await ref.set({
      id: ref.id,
      contractDraftId: invite.contractDraftId,
      role: invite.role,
      codebtorSlot: slot,
      inviterUid: invite.inviterUid,
      inviteToken: invite.token,
      uploadedByName: invite.contribution?.fullName || invite.inviteeName || "",
      ...(docKey ? { docKey } : {}),
      storagePath,
      fileName: filename,
      contentType,
      sizeBytes: buf.length,
      uploadedAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
    });

    auditEvent("invite_support_uploaded", { contractId: invite.contractDraftId, role: invite.role });
    return NextResponse.json({ success: true, id: ref.id });
  } catch (e) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo subir el documento en el servidor." }], detail: e instanceof Error ? e.message.slice(0, 200) : "error" },
      { status: 500 },
    );
  }
}
