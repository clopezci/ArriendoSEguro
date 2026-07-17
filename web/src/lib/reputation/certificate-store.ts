import "server-only";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { AGGREGATES_COLLECTION, normalizeEmail, subjectKeyFromEmail } from "@/lib/reputation/aggregate-store";

/**
 * Certificados de reputación **iniciados por el titular**: el usuario genera un
 * enlace de SU PROPIA reputación para mostrarla voluntariamente a otro usuario
 * de la app. Cumplimiento Ley 1581/2012: el consentimiento es del titular sobre
 * sus propios datos; el enlace caduca, es revocable y solo lo abren usuarios
 * autenticados (no hay consulta pública ni por cédula).
 */
export const CERTIFICATE_COLLECTION = "reputation_certificates";

/** Días de vigencia por defecto del certificado. */
export const CERTIFICATE_TTL_DAYS = 7;

export type ReputationCertificate = {
  token: string;
  ownerUid: string;
  subjectEmail: string;
  subjectKey: string;
  createdAt: string;
  expiresAt: string;
  revoked: boolean;
  viewCount: number;
};

function newToken(): string {
  return randomBytes(24).toString("hex");
}

/** Crea (o renueva) un certificado del titular sobre su propia reputación. */
export async function createCertificate(
  firestore: Firestore,
  params: { ownerUid: string; ownerEmail: string; ttlDays?: number },
): Promise<{ token: string; expiresAt: string }> {
  const subjectEmail = normalizeEmail(params.ownerEmail);
  const token = newToken();
  const now = new Date();
  const ttl = params.ttlDays ?? CERTIFICATE_TTL_DAYS;
  const expiresAt = new Date(now.getTime() + ttl * 24 * 60 * 60 * 1000).toISOString();
  await firestore
    .collection(CERTIFICATE_COLLECTION)
    .doc(token)
    .set({
      token,
      ownerUid: params.ownerUid,
      subjectEmail,
      subjectKey: subjectKeyFromEmail(subjectEmail),
      createdAt: now.toISOString(),
      createdAtServer: FieldValue.serverTimestamp(),
      expiresAt,
      revoked: false,
      viewCount: 0,
    });
  return { token, expiresAt };
}

/** Lista los certificados vigentes/creados por el titular (para gestionarlos). */
export async function listCertificatesForOwner(
  firestore: Firestore,
  ownerUid: string,
): Promise<ReputationCertificate[]> {
  const snap = await firestore
    .collection(CERTIFICATE_COLLECTION)
    .where("ownerUid", "==", ownerUid)
    .get()
    .catch(() => null);
  return (snap?.docs ?? [])
    .map((d) => d.data() as ReputationCertificate)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Revoca un certificado (solo su dueño). Devuelve false si no le pertenece. */
export async function revokeCertificate(firestore: Firestore, ownerUid: string, token: string): Promise<boolean> {
  const ref = firestore.collection(CERTIFICATE_COLLECTION).doc(token);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() as ReputationCertificate;
  if (data.ownerUid !== ownerUid) return false;
  await ref.set({ revoked: true }, { merge: true });
  return true;
}

export type CertificateView =
  | { ok: true; subjectEmail: string; aggregate: { totalReviews: number; overallAverage: number; byDirection: unknown[] } }
  | { ok: false; reason: "not_found" | "revoked" | "expired" };

/**
 * Resuelve un certificado por token y devuelve el **agregado** del titular si
 * está vigente. Registra la consulta (viewCount). NO expone quién calificó.
 */
export async function resolveCertificate(
  firestore: Firestore,
  token: string,
  nowMs: number = Date.now(),
): Promise<CertificateView> {
  const ref = firestore.collection(CERTIFICATE_COLLECTION).doc(token);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, reason: "not_found" };
  const cert = snap.data() as ReputationCertificate;
  if (cert.revoked) return { ok: false, reason: "revoked" };
  if (Date.parse(cert.expiresAt) <= nowMs) return { ok: false, reason: "expired" };

  const aggSnap = await firestore.collection(AGGREGATES_COLLECTION).doc(cert.subjectKey).get();
  const a = (aggSnap.exists ? aggSnap.data() : {}) as Record<string, unknown>;
  await ref.set({ viewCount: FieldValue.increment(1), lastViewedAt: new Date(nowMs).toISOString() }, { merge: true });
  return {
    ok: true,
    subjectEmail: cert.subjectEmail,
    aggregate: {
      totalReviews: Number(a.totalReviews ?? 0),
      overallAverage: Number(a.overallAverage ?? 0),
      byDirection: (a.byDirection as unknown[]) ?? [],
    },
  };
}
