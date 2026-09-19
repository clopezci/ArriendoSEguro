import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

export const INTAKE_SUBMISSIONS_COLLECTION = "intake_submissions";

export type IntakeStatus = "pending" | "used" | "discarded";

export interface IntakeTenant {
  fullName: string;
  documentType: string;
  documentNumber: string;
  city: string;
  email: string;
  phone: string;
}

export interface IntakeIdentity {
  approved: boolean;
  confianza: number | null;
  nombreRegistrado: string | null;
  checkedAt: string;
}

export interface IntakeSubmission {
  id: string;
  agencyId: string;
  tenant: IntakeTenant;
  /** Dirección/inmueble que le interesa (texto libre del solicitante). */
  propertyHint?: string;
  /** Mensaje libre opcional del solicitante. */
  note?: string;
  identity?: IntakeIdentity;
  status: IntakeStatus;
  contractId?: string;
  source: "web" | "whatsapp";
  createdAtIso: string;
  updatedAtIso: string;
}

function dedupKey(agencyId: string, documentNumber: string): string {
  return `${agencyId}:${String(documentNumber).replace(/\D/g, "")}`;
}

export type CreateSubmissionInput = {
  tenant: IntakeTenant;
  propertyHint?: string;
  note?: string;
  identity?: IntakeIdentity;
  source?: "web" | "whatsapp";
};

/**
 * Crea una solicitud, o ACTUALIZA la pendiente existente del mismo documento en
 * la misma agencia (dedup: "sin repetidos"). Devuelve la solicitud resultante.
 */
export async function createOrUpdateSubmission(
  firestore: Firestore,
  agencyId: string,
  input: CreateSubmissionInput,
): Promise<{ submission: IntakeSubmission; deduped: boolean }> {
  const nowIso = new Date().toISOString();
  const key = dedupKey(agencyId, input.tenant.documentNumber);

  const existing = await firestore
    .collection(INTAKE_SUBMISSIONS_COLLECTION)
    .where("dedupKey", "==", key)
    .where("status", "==", "pending")
    .limit(1)
    .get()
    .catch(() => null);

  const base = {
    agencyId,
    tenant: input.tenant,
    ...(input.propertyHint ? { propertyHint: input.propertyHint } : {}),
    ...(input.note ? { note: input.note } : {}),
    ...(input.identity ? { identity: input.identity } : {}),
    source: input.source ?? "web",
    status: "pending" as IntakeStatus,
    dedupKey: key,
    updatedAtIso: nowIso,
  };

  if (existing && !existing.empty) {
    const doc = existing.docs[0];
    await doc.ref.set({ ...base, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true });
    const data = doc.data() as IntakeSubmission;
    return { submission: { ...data, ...base, id: doc.id, createdAtIso: data.createdAtIso ?? nowIso }, deduped: true };
  }

  const ref = firestore.collection(INTAKE_SUBMISSIONS_COLLECTION).doc();
  const submission: IntakeSubmission = { id: ref.id, createdAtIso: nowIso, ...base } as IntakeSubmission;
  await ref.set({ ...submission, createdAtServer: FieldValue.serverTimestamp(), updatedAtServer: FieldValue.serverTimestamp() });
  return { submission, deduped: false };
}

export async function listSubmissions(firestore: Firestore, agencyId: string, status?: IntakeStatus): Promise<IntakeSubmission[]> {
  let q = firestore.collection(INTAKE_SUBMISSIONS_COLLECTION).where("agencyId", "==", agencyId);
  if (status) q = q.where("status", "==", status);
  const snap = await q.limit(1000).get();
  const rows = snap.docs.map((d) => ({ ...(d.data() as IntakeSubmission), id: d.id }));
  rows.sort((a, b) => (a.createdAtIso < b.createdAtIso ? 1 : -1));
  return rows;
}

export async function getSubmission(firestore: Firestore, id: string): Promise<IntakeSubmission | null> {
  const snap = await firestore.collection(INTAKE_SUBMISSIONS_COLLECTION).doc(id).get();
  return snap.exists ? ({ ...(snap.data() as IntakeSubmission), id: snap.id }) : null;
}

export async function setSubmissionStatus(
  firestore: Firestore,
  id: string,
  status: IntakeStatus,
  contractId?: string,
): Promise<void> {
  await firestore.collection(INTAKE_SUBMISSIONS_COLLECTION).doc(id).set(
    { status, ...(contractId ? { contractId } : {}), updatedAtIso: new Date().toISOString(), updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
