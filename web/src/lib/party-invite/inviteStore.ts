import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import {
  PARTY_INVITES_COLLECTION,
  PARTY_INVITE_TTL_DAYS,
  newInviteToken,
  normalizeEmail,
  type PartyInviteDoc,
  type PartyRole,
} from "@/domain/party-invite/partyInvite";

export async function getInvite(firestore: Firestore, token: string): Promise<PartyInviteDoc | null> {
  if (!token) return null;
  const snap = await firestore.collection(PARTY_INVITES_COLLECTION).doc(token).get();
  return snap.exists ? (snap.data() as PartyInviteDoc) : null;
}

export type CreateInviteParams = {
  contractDraftId: string;
  role: PartyRole;
  inviteeEmail: string;
  inviteeName: string;
  inviterUid: string;
  inviterEmail: string;
  inviterName: string;
  monthlyRent?: number;
  /** Índice del codeudor (0 = principal; 1, 2… = adicionales). */
  codebtorSlot?: number;
  /**
   * Si es `true` (solo codeudor), el SERVIDOR asigna el siguiente slot LIBRE
   * (≥1) para un codeudor NUEVO, evitando colisiones entre dueño e inquilino.
   * Si el correo ya tiene un enlace activo, reutiliza ese (no duplica).
   */
  assignNewSlot?: boolean;
};

/**
 * Crea una invitación. Si ya hay una **activa** para el mismo contrato+rol y el
 * MISMO correo, la reutiliza (no multiplica enlaces). Si el correo es DISTINTO
 * (el dueño cambió el destinatario), invalida la anterior y crea una nueva para
 * el nuevo correo: antes se reutilizaba a ciegas y el enlace seguía yendo al
 * correo original aunque se escribiera otro.
 */
export async function createInvite(firestore: Firestore, params: CreateInviteParams): Promise<PartyInviteDoc> {
  const newEmail = normalizeEmail(params.inviteeEmail);
  const existing = await firestore
    .collection(PARTY_INVITES_COLLECTION)
    .where("contractDraftId", "==", params.contractDraftId)
    .where("role", "==", params.role)
    .where("status", "==", "active")
    .limit(20)
    .get()
    .catch(() => null);
  const activeDocs = existing?.docs ?? [];
  const slotOf = (d: (typeof activeDocs)[number]) => (d.data() as PartyInviteDoc).codebtorSlot ?? 0;

  let slot: number;
  if (params.role === "solidaryCoDebtor" && params.assignNewSlot === true) {
    // Codeudor NUEVO: el servidor asigna el siguiente slot libre (≥1). Si el
    // correo ya tiene enlace activo, reutiliza ese (no duplica).
    if (newEmail) {
      const sameEmail = activeDocs.find((d) => normalizeEmail((d.data() as PartyInviteDoc).inviteeEmail) === newEmail);
      if (sameEmail) {
        const data = sameEmail.data() as PartyInviteDoc;
        if (typeof params.monthlyRent === "number" && params.monthlyRent > 0 && data.monthlyRent !== params.monthlyRent) {
          await sameEmail.ref.set({ monthlyRent: params.monthlyRent }, { merge: true });
          return { ...data, monthlyRent: params.monthlyRent };
        }
        return data;
      }
    }
    const used = new Set(activeDocs.map(slotOf));
    let s = 1;
    while (used.has(s)) s += 1;
    slot = s;
  } else {
    // Slot fijo (0 = principal / cambiar destinatario de ese codeudor).
    slot = Math.max(0, Math.floor(params.codebtorSlot ?? 0));
    const docForSlot = activeDocs.find((d) => slotOf(d) === slot) ?? null;
    if (docForSlot) {
      const data = docForSlot.data() as PartyInviteDoc;
      if (normalizeEmail(data.inviteeEmail) === newEmail) {
        if (typeof params.monthlyRent === "number" && params.monthlyRent > 0 && data.monthlyRent !== params.monthlyRent) {
          await docForSlot.ref.set({ monthlyRent: params.monthlyRent }, { merge: true });
          return { ...data, monthlyRent: params.monthlyRent };
        }
        return data;
      }
      // Correo distinto para el MISMO slot (cambió el destinatario): invalidamos.
      await docForSlot.ref.set({ status: "expired", updatedAt: new Date().toISOString() }, { merge: true });
    }
  }

  const token = newInviteToken();
  const now = new Date();
  const expires = new Date(now.getTime() + PARTY_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const doc: PartyInviteDoc = {
    token,
    contractDraftId: params.contractDraftId,
    role: params.role,
    inviteeEmail: normalizeEmail(params.inviteeEmail),
    inviteeName: params.inviteeName,
    inviterUid: params.inviterUid,
    inviterEmail: params.inviterEmail,
    inviterName: params.inviterName,
    ...(typeof params.monthlyRent === "number" && params.monthlyRent > 0 ? { monthlyRent: params.monthlyRent } : {}),
    ...(slot > 0 ? { codebtorSlot: slot } : {}),
    status: "active",
    otpVerifyAttempts: 0,
    contribution: null,
    completedAt: null,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  await firestore
    .collection(PARTY_INVITES_COLLECTION)
    .doc(token)
    .set({ ...doc, createdAtServer: FieldValue.serverTimestamp() });
  return doc;
}
