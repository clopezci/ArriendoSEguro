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
};

/**
 * Crea una invitación. Si ya hay una **activa** para el mismo contrato+rol,
 * la reutiliza (no multiplica enlaces).
 */
export async function createInvite(firestore: Firestore, params: CreateInviteParams): Promise<PartyInviteDoc> {
  const existing = await firestore
    .collection(PARTY_INVITES_COLLECTION)
    .where("contractDraftId", "==", params.contractDraftId)
    .where("role", "==", params.role)
    .where("status", "==", "active")
    .limit(1)
    .get()
    .catch(() => null);
  if (existing && !existing.empty) {
    return existing.docs[0].data() as PartyInviteDoc;
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
