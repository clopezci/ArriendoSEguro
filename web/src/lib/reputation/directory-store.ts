import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { AGGREGATES_COLLECTION, normalizeEmail, subjectKeyFromEmail } from "@/lib/reputation/aggregate-store";
import { REPUTATION_DIRECTORY_POLICY_VERSION } from "@/domain/reputation/directoryFlags";

/**
 * Autorizaciones **opt-in** de visibilidad de reputación en el directorio (que
 * otros usuarios registrados consulten mi agregado, con la finalidad de evaluar
 * un arriendo). Guarda evidencia (fecha, versión de política, IP, user-agent)
 * como soporte del consentimiento (Ley 1581 de 2012). Es **revocable**.
 */
export const DIRECTORY_CONSENTS_COLLECTION = "reputation_directory_consents";

export type DirectoryAuthorization = {
  authorized: boolean;
  authorizedAt: string | null;
  revokedAt: string | null;
  policyVersion: string | null;
};

/** Fija/actualiza la autorización opt-in del titular (sobre su propio correo). */
export async function setDirectoryAuthorization(
  firestore: Firestore,
  params: { uid: string; email: string; authorized: boolean; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  const subjectEmail = normalizeEmail(params.email);
  const key = subjectKeyFromEmail(subjectEmail);
  const now = new Date().toISOString();
  await firestore
    .collection(DIRECTORY_CONSENTS_COLLECTION)
    .doc(key)
    .set(
      {
        uid: params.uid,
        subjectEmail,
        subjectKey: key,
        authorized: params.authorized,
        authorizedAt: params.authorized ? now : FieldValue.delete(),
        revokedAt: params.authorized ? null : now,
        policyVersion: params.authorized ? REPUTATION_DIRECTORY_POLICY_VERSION : null,
        lastEvidence: { ip: params.ip ?? null, userAgent: params.userAgent ?? null, at: now },
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

/** Autorización actual del titular (por su correo). */
export async function getDirectoryAuthorization(firestore: Firestore, email: string): Promise<DirectoryAuthorization> {
  const key = subjectKeyFromEmail(normalizeEmail(email));
  const snap = await firestore.collection(DIRECTORY_CONSENTS_COLLECTION).doc(key).get();
  if (!snap.exists) return { authorized: false, authorizedAt: null, revokedAt: null, policyVersion: null };
  const d = snap.data() as Record<string, unknown>;
  return {
    authorized: Boolean(d.authorized),
    authorizedAt: d.authorizedAt ? String(d.authorizedAt) : null,
    revokedAt: d.revokedAt ? String(d.revokedAt) : null,
    policyVersion: d.policyVersion ? String(d.policyVersion) : null,
  };
}

export type DirectoryLookup =
  | { authorized: true; subjectEmail: string; aggregate: { totalReviews: number; overallAverage: number; byDirection: unknown[] } }
  | { authorized: false };

/**
 * Consulta el agregado de un titular en el directorio. Devuelve el agregado
 * SOLO si el titular autorizó opt-in; en caso contrario, `authorized:false`
 * (el solicitante puede usar el flujo de consentimiento puntual existente).
 */
export async function lookupDirectory(firestore: Firestore, subjectEmail: string): Promise<DirectoryLookup> {
  const email = normalizeEmail(subjectEmail);
  const key = subjectKeyFromEmail(email);
  const auth = await getDirectoryAuthorization(firestore, email);
  if (!auth.authorized) return { authorized: false };
  const aggSnap = await firestore.collection(AGGREGATES_COLLECTION).doc(key).get();
  const a = (aggSnap.exists ? aggSnap.data() : {}) as Record<string, unknown>;
  return {
    authorized: true,
    subjectEmail: email,
    aggregate: {
      totalReviews: Number(a.totalReviews ?? 0),
      overallAverage: Number(a.overallAverage ?? 0),
      byDirection: (a.byDirection as unknown[]) ?? [],
    },
  };
}
