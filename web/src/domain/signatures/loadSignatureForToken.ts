import type { DocumentReference } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { parseSignatureToken, isTokenExpired } from "@/domain/signatures/validateSignatureToken";
import type { SignatureRecord } from "@/domain/signatures/types";

export type LoadedSignature =
  | { ok: true; ref: DocumentReference; data: SignatureRecord }
  | { ok: false; status: number; message: string };

/**
 * Carga la solicitud de firma por token opaco (mismo criterio que complete/token-info).
 */
export async function loadSignatureForToken(token: string): Promise<LoadedSignature> {
  const parsed = parseSignatureToken(token);
  if (!parsed) {
    return { ok: false, status: 422, message: "Token inválido." };
  }
  const firestore = getAdminFirestore();
  if (!firestore) {
    return { ok: false, status: 503, message: "Firestore no configurado." };
  }
  const ref = firestore.collection("signatures").doc(parsed.signatureId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { ok: false, status: 404, message: "Firma no encontrada." };
  }
  const data = { id: snap.id, ...(snap.data() as Omit<SignatureRecord, "id">) } as SignatureRecord;
  if (data.tokenHash !== parsed.tokenHash) {
    return { ok: false, status: 422, message: "Token inválido." };
  }
  if (isTokenExpired(data.tokenExpiresAt)) {
    return { ok: false, status: 410, message: "El enlace de firma expiró." };
  }
  return { ok: true, ref, data };
}
