import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import { isInviteOpenForUpload } from "@/domain/party-invite/partyInvite";
import { PARTY_INVITE_SUPPORTS_COLLECTION } from "@/domain/party-invite/inviteSupports";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Borra un soporte subido por el INVITADO (inquilino/codeudor) desde su enlace.
 * Gateado por el token del enlace + OTP; solo borra documentos que pertenecen a
 * ESA invitación. Elimina el objeto en Storage y su registro en Firestore.
 */
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

    const body = (await request.json().catch(() => ({}))) as { token?: string; id?: string };
    const token = (body.token ?? "").trim();
    const id = (body.id ?? "").trim();
    if (!id) return err("Falta el identificador del documento.");

    const invite = await getInvite(firestore, token);
    if (!invite || !isInviteOpenForUpload(invite, Date.now())) return err("El enlace no es válido o expiró.", 410, "token");
    if (!invite.otpVerifiedAt) return err("Valida primero tu identidad con el código.", 403, "otp");

    const ref = firestore.collection(PARTY_INVITE_SUPPORTS_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ success: true, deleted: false });

    const data = snap.data() as { inviteToken?: string; storagePath?: string };
    if (data.inviteToken !== invite.token) return err("No autorizado para borrar este documento.", 403, "auth");

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    const gsPrefix = bucketName ? `gs://${bucketName}/` : "";
    const objectPath = gsPrefix && (data.storagePath ?? "").startsWith(gsPrefix) ? (data.storagePath ?? "").slice(gsPrefix.length) : "";
    if (bucketName && objectPath) {
      await getStorage().bucket(bucketName).file(objectPath).delete().catch(() => {});
    }
    await ref.delete();
    return NextResponse.json({ success: true, deleted: true });
  } catch {
    return err("No se pudo borrar el documento.", 500, "server");
  }
}
