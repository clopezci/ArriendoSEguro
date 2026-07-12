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
    .limit(1)
    .get()
    .catch(() => null);
  if (existing && !existing.empty) {
    const doc = existing.docs[0];
    const data = doc.data() as PartyInviteDoc;
    if (normalizeEmail(data.inviteeEmail) === newEmail) {
      // Mismo destinatario → mismo enlace. Actualizamos el canon si cambió/faltaba.
      if (typeof params.monthlyRent === "number" && params.monthlyRent > 0 && data.monthlyRent !== params.monthlyRent) {
        await doc.ref.set({ monthlyRent: params.monthlyRent }, { merge: true });
        return { ...data, monthlyRent: params.monthlyRent };
      }
      return data;
    }
    // Correo distinto (otra persona): invalidamos el enlace anterior y creamos
    // uno nuevo abajo, para que el correo llegue al destinatario correcto.
    await doc.ref.set({ status: "expired", updatedAt: new Date().toISOString() }, { merge: true });
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
