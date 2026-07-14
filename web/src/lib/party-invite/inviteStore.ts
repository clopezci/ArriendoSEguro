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
  const slot = Math.max(0, Math.floor(params.codebtorSlot ?? 0));
  const existing = await firestore
    .collection(PARTY_INVITES_COLLECTION)
    .where("contractDraftId", "==", params.contractDraftId)
    .where("role", "==", params.role)
    .where("status", "==", "active")
    .limit(20)
    .get()
    .catch(() => null);
  // Buscamos el enlace activo de ESTE slot (codeudor) — así varios codeudores
  // conviven sin pisarse. Slot ausente = 0 (compatibilidad con enlaces previos).
  const docForSlot = existing?.docs.find((d) => ((d.data() as PartyInviteDoc).codebtorSlot ?? 0) === slot) ?? null;
  if (docForSlot) {
    const data = docForSlot.data() as PartyInviteDoc;
    if (normalizeEmail(data.inviteeEmail) === newEmail) {
      // Mismo destinatario → mismo enlace. Actualizamos el canon si cambió/faltaba.
      if (typeof params.monthlyRent === "number" && params.monthlyRent > 0 && data.monthlyRent !== params.monthlyRent) {
        await docForSlot.ref.set({ monthlyRent: params.monthlyRent }, { merge: true });
        return { ...data, monthlyRent: params.monthlyRent };
      }
      return data;
    }
    // Correo distinto para el MISMO slot (cambió el destinatario de ese codeudor):
    // invalidamos ese enlace y creamos uno nuevo abajo.
    await docForSlot.ref.set({ status: "expired", updatedAt: new Date().toISOString() }, { merge: true });
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
