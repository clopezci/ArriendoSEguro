import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { computeConsentHash } from "@/domain/consents/consentVersions";
import type { ConsentRecord, ConsentSurface, ConsentVersion } from "@/domain/consents/types";

/**
 * Registra el consentimiento informado del usuario en la colección
 * `user_consents`. Cada documento es inmutable y conserva el contexto
 * (IP, user agent, hash del texto y momento de aceptación) para fines
 * probatorios bajo la Ley 1581 de 2012.
 */
export async function recordUserConsent(
  firestore: Firestore,
  input: {
    uid: string;
    email: string;
    version: ConsentVersion | string;
    surface: ConsentSurface;
    ipAddress: string | null;
    userAgent: string | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const hash = computeConsentHash(input.version);
  if (!hash) return { ok: false, reason: "Versión de consentimiento desconocida." };

  const nowIso = new Date().toISOString();
  const doc: ConsentRecord = {
    uid: input.uid,
    email: input.email.toLowerCase(),
    version: input.version,
    surface: input.surface,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    consentHash: hash,
    acceptedAt: nowIso,
  };
  const ref = await firestore.collection("user_consents").add({
    ...doc,
    acceptedAtServer: FieldValue.serverTimestamp(),
  });
  return { ok: true, id: ref.id };
}

/**
 * Indica si el usuario tiene un consentimiento vigente para la versión
 * indicada. Si alguna vez se publican varias versiones simultáneamente,
 * el llamador es responsable de decidir cuál exigir.
 */
export async function hasActiveConsent(
  firestore: Firestore,
  uid: string,
  version: ConsentVersion | string,
): Promise<boolean> {
  const snap = await firestore
    .collection("user_consents")
    .where("uid", "==", uid)
    .where("version", "==", version)
    .limit(1)
    .get();
  return !snap.empty;
}
