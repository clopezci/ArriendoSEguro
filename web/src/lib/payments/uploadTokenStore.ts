import "server-only";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import {
  PAYMENT_UPLOAD_TOKENS_COLLECTION,
  PAYMENT_UPLOAD_TOKEN_TTL_DAYS,
  type PaymentUploadTokenDoc,
} from "@/domain/payments/paymentUploadToken";

export function newUploadToken(): string {
  return randomBytes(24).toString("hex");
}

export interface CreateUploadTokenParams {
  contractId: string;
  contractVersionId: string;
  scheduledPaymentId?: string | null;
  periodLabel: string;
  dueDate: string;
  expectedAmount: number;
  landlordName: string;
}

/**
 * Crea (o reutiliza) un token de subida para un periodo. Si ya hay uno activo
 * para el mismo `scheduledPaymentId`, lo reutiliza para no multiplicar enlaces.
 */
export async function createUploadToken(
  firestore: Firestore,
  params: CreateUploadTokenParams,
): Promise<string> {
  if (params.scheduledPaymentId) {
    const existing = await firestore
      .collection(PAYMENT_UPLOAD_TOKENS_COLLECTION)
      .where("scheduledPaymentId", "==", params.scheduledPaymentId)
      .where("status", "==", "active")
      .limit(1)
      .get()
      .catch(() => null);
    if (existing && !existing.empty) return existing.docs[0].id;
  }

  const token = newUploadToken();
  const now = new Date();
  const expires = new Date(now.getTime() + PAYMENT_UPLOAD_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const doc: PaymentUploadTokenDoc = {
    token,
    contractId: params.contractId,
    contractVersionId: params.contractVersionId,
    scheduledPaymentId: params.scheduledPaymentId ?? null,
    periodLabel: params.periodLabel,
    dueDate: params.dueDate,
    expectedAmount: Number(params.expectedAmount) || 0,
    landlordName: params.landlordName,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  await firestore
    .collection(PAYMENT_UPLOAD_TOKENS_COLLECTION)
    .doc(token)
    .set({ ...doc, createdAtServer: FieldValue.serverTimestamp() });
  return token;
}

export async function getUploadToken(
  firestore: Firestore,
  token: string,
): Promise<PaymentUploadTokenDoc | null> {
  if (!token) return null;
  const snap = await firestore.collection(PAYMENT_UPLOAD_TOKENS_COLLECTION).doc(token).get();
  return snap.exists ? (snap.data() as PaymentUploadTokenDoc) : null;
}
