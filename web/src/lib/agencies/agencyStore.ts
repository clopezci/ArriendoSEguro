import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import {
  AGENCIES_COLLECTION,
  AGENCY_CREDITS_COLLECTION,
  AGENCY_LANDLORDS_COLLECTION,
  AGENCY_PROPERTIES_COLLECTION,
  normalizeAgencyEmail,
  type Agency,
  type AgencyCredits,
  type AgencyLandlord,
  type AgencyProperty,
} from "@/domain/agencies/types";
import type { PersonParty } from "@/domain/contracts/types";

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Agencies
// ---------------------------------------------------------------------------

export async function getAgency(firestore: Firestore, agencyId: string): Promise<Agency | null> {
  if (!agencyId) return null;
  const snap = await firestore.collection(AGENCIES_COLLECTION).doc(agencyId).get();
  return snap.exists ? ({ ...(snap.data() as Agency), id: snap.id }) : null;
}

/** Todas las agencias (para el panel admin). */
export async function listAllAgencies(firestore: Firestore): Promise<Agency[]> {
  const snap = await firestore.collection(AGENCIES_COLLECTION).orderBy("createdAt", "desc").limit(500).get();
  return snap.docs.map((d) => ({ ...(d.data() as Agency), id: d.id }));
}

/** Agencias donde el correo es miembro. */
export async function listAgenciesForEmail(firestore: Firestore, email: string): Promise<Agency[]> {
  const target = normalizeAgencyEmail(email);
  if (!target) return [];
  const snap = await firestore
    .collection(AGENCIES_COLLECTION)
    .where("memberEmails", "array-contains", target)
    .limit(100)
    .get()
    .catch(() => null);
  return (snap?.docs ?? []).map((d) => ({ ...(d.data() as Agency), id: d.id }));
}

export type CreateAgencyParams = {
  name: string;
  nit?: string;
  contactEmail: string;
  contactPhone?: string;
  /** Correo de escalamiento/PQR (obligatorio para casos de fraude). */
  escalationEmail: string;
  ownerUid: string;
  /** Correos miembros (se normalizan). Se incluye el contactEmail por defecto. */
  memberEmails?: string[];
};

export async function createAgency(firestore: Firestore, params: CreateAgencyParams): Promise<Agency> {
  const ref = firestore.collection(AGENCIES_COLLECTION).doc();
  const members = new Set<string>(
    [params.contactEmail, ...(params.memberEmails ?? [])].map(normalizeAgencyEmail).filter(Boolean),
  );
  const agency: Agency = {
    id: ref.id,
    name: params.name.trim(),
    ...(params.nit ? { nit: params.nit.trim() } : {}),
    contactEmail: normalizeAgencyEmail(params.contactEmail),
    ...(params.contactPhone ? { contactPhone: params.contactPhone.trim() } : {}),
    escalationEmail: normalizeAgencyEmail(params.escalationEmail),
    identityEnabled: true,
    memberEmails: Array.from(members),
    ownerUid: params.ownerUid,
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await ref.set({ ...agency, createdAtServer: FieldValue.serverTimestamp() });
  // Inicializa el saldo de créditos en 0.
  await firestore
    .collection(AGENCY_CREDITS_COLLECTION)
    .doc(ref.id)
    .set({ agencyId: ref.id, balance: 0, totalPurchased: 0, totalConsumed: 0, updatedAt: nowIso() } satisfies AgencyCredits);
  return agency;
}

export async function updateAgency(
  firestore: Firestore,
  agencyId: string,
  patch: Partial<Pick<Agency, "name" | "nit" | "contactEmail" | "contactPhone" | "escalationEmail" | "identityEnabled" | "whatsappNumber" | "logoUrl" | "memberEmails" | "status">>,
): Promise<void> {
  const clean: Record<string, unknown> = { updatedAt: nowIso() };
  if (typeof patch.name === "string") clean.name = patch.name.trim();
  if (typeof patch.nit === "string") clean.nit = patch.nit.trim();
  if (typeof patch.contactEmail === "string") clean.contactEmail = normalizeAgencyEmail(patch.contactEmail);
  if (typeof patch.contactPhone === "string") clean.contactPhone = patch.contactPhone.trim();
  if (typeof patch.escalationEmail === "string") clean.escalationEmail = normalizeAgencyEmail(patch.escalationEmail);
  if (typeof patch.identityEnabled === "boolean") clean.identityEnabled = patch.identityEnabled;
  if (typeof patch.whatsappNumber === "string") clean.whatsappNumber = patch.whatsappNumber.replace(/[^\d+]/g, "");
  if (typeof patch.logoUrl === "string") clean.logoUrl = patch.logoUrl.trim();
  if (patch.status) clean.status = patch.status;
  if (Array.isArray(patch.memberEmails)) {
    clean.memberEmails = Array.from(new Set(patch.memberEmails.map(normalizeAgencyEmail).filter(Boolean)));
  }
  await firestore.collection(AGENCIES_COLLECTION).doc(agencyId).set(clean, { merge: true });
}

// ---------------------------------------------------------------------------
// Landlords (reusable)
// ---------------------------------------------------------------------------

export async function listLandlords(firestore: Firestore, agencyId: string): Promise<AgencyLandlord[]> {
  const snap = await firestore
    .collection(AGENCY_LANDLORDS_COLLECTION)
    .where("agencyId", "==", agencyId)
    .limit(500)
    .get();
  return snap.docs.map((d) => ({ ...(d.data() as AgencyLandlord), id: d.id }));
}

export async function getLandlord(firestore: Firestore, id: string): Promise<AgencyLandlord | null> {
  const snap = await firestore.collection(AGENCY_LANDLORDS_COLLECTION).doc(id).get();
  return snap.exists ? ({ ...(snap.data() as AgencyLandlord), id: snap.id }) : null;
}

export async function createLandlord(firestore: Firestore, agencyId: string, party: PersonParty): Promise<AgencyLandlord> {
  const ref = firestore.collection(AGENCY_LANDLORDS_COLLECTION).doc();
  const doc: AgencyLandlord = { id: ref.id, agencyId, party, createdAt: nowIso(), updatedAt: nowIso() };
  await ref.set(doc);
  return doc;
}

export async function updateLandlord(firestore: Firestore, id: string, party: PersonParty): Promise<void> {
  await firestore.collection(AGENCY_LANDLORDS_COLLECTION).doc(id).set({ party, updatedAt: nowIso() }, { merge: true });
}

export async function deleteLandlord(firestore: Firestore, id: string): Promise<void> {
  await firestore.collection(AGENCY_LANDLORDS_COLLECTION).doc(id).delete();
}

// ---------------------------------------------------------------------------
// Properties (reusable)
// ---------------------------------------------------------------------------

export async function listProperties(firestore: Firestore, agencyId: string): Promise<AgencyProperty[]> {
  const snap = await firestore
    .collection(AGENCY_PROPERTIES_COLLECTION)
    .where("agencyId", "==", agencyId)
    .limit(500)
    .get();
  return snap.docs.map((d) => ({ ...(d.data() as AgencyProperty), id: d.id }));
}

export async function getProperty(firestore: Firestore, id: string): Promise<AgencyProperty | null> {
  const snap = await firestore.collection(AGENCY_PROPERTIES_COLLECTION).doc(id).get();
  return snap.exists ? ({ ...(snap.data() as AgencyProperty), id: snap.id }) : null;
}

export type PropertyInput = Omit<AgencyProperty, "id" | "agencyId" | "createdAt" | "updatedAt">;

export async function createProperty(firestore: Firestore, agencyId: string, input: PropertyInput): Promise<AgencyProperty> {
  const ref = firestore.collection(AGENCY_PROPERTIES_COLLECTION).doc();
  const doc: AgencyProperty = { id: ref.id, agencyId, ...input, createdAt: nowIso(), updatedAt: nowIso() };
  await ref.set(doc);
  return doc;
}

export async function updateProperty(firestore: Firestore, id: string, input: Partial<PropertyInput>): Promise<void> {
  await firestore.collection(AGENCY_PROPERTIES_COLLECTION).doc(id).set({ ...input, updatedAt: nowIso() }, { merge: true });
}

export async function deleteProperty(firestore: Firestore, id: string): Promise<void> {
  await firestore.collection(AGENCY_PROPERTIES_COLLECTION).doc(id).delete();
}

// ---------------------------------------------------------------------------
// Credits (prepay pool)
// ---------------------------------------------------------------------------

export async function getCredits(firestore: Firestore, agencyId: string): Promise<AgencyCredits> {
  const snap = await firestore.collection(AGENCY_CREDITS_COLLECTION).doc(agencyId).get();
  if (snap.exists) return { ...(snap.data() as AgencyCredits), agencyId };
  return { agencyId, balance: 0, totalPurchased: 0, totalConsumed: 0, updatedAt: nowIso() };
}

/** Suma créditos (compra de paquete). Devuelve el saldo nuevo. */
export async function addCredits(firestore: Firestore, agencyId: string, amount: number): Promise<number> {
  const qty = Math.max(0, Math.floor(amount));
  const ref = firestore.collection(AGENCY_CREDITS_COLLECTION).doc(agencyId);
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() as AgencyCredits) : { balance: 0, totalPurchased: 0, totalConsumed: 0 };
    const balance = (cur.balance ?? 0) + qty;
    tx.set(
      ref,
      { agencyId, balance, totalPurchased: (cur.totalPurchased ?? 0) + qty, totalConsumed: cur.totalConsumed ?? 0, updatedAt: nowIso() },
      { merge: true },
    );
    return balance;
  });
}

/**
 * Consume un crédito de forma atómica. Devuelve `{ ok, balance }`. `ok:false` si
 * no hay saldo. Idempotencia por contrato la maneja el llamador (lifecycle).
 */
export async function consumeCredit(firestore: Firestore, agencyId: string): Promise<{ ok: boolean; balance: number }> {
  const ref = firestore.collection(AGENCY_CREDITS_COLLECTION).doc(agencyId);
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() as AgencyCredits) : { balance: 0, totalPurchased: 0, totalConsumed: 0 };
    const balance = cur.balance ?? 0;
    if (balance <= 0) return { ok: false, balance: 0 };
    const next = balance - 1;
    tx.set(
      ref,
      { agencyId, balance: next, totalPurchased: cur.totalPurchased ?? 0, totalConsumed: (cur.totalConsumed ?? 0) + 1, updatedAt: nowIso() },
      { merge: true },
    );
    return { ok: true, balance: next };
  });
}
