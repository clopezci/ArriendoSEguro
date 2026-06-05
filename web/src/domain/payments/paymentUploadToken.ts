/**
 * Token de subida de pago del **inquilino** (enlace mágico, sin login).
 *
 * El dueño/recordatorio genera un token por periodo. El inquilino abre
 * `/pago/<token>`, ve cómo pagar (QR/cuenta) y sube su soporte. El soporte NO
 * marca el pago como confirmado: queda **pendiente** hasta que el dueño lo
 * confirme. El token es un secreto largo, está acotado a un contrato/periodo y
 * caduca. Módulo **puro** (sin Firebase ni red).
 */

export const PAYMENT_UPLOAD_TOKENS_COLLECTION = "payment_upload_tokens";

/** Vigencia por defecto del enlace (45 días cubre el ciclo de un periodo). */
export const PAYMENT_UPLOAD_TOKEN_TTL_DAYS = 45;

export type PaymentUploadTokenStatus = "active" | "used" | "expired";

export interface PaymentUploadTokenDoc {
  token: string;
  contractId: string;
  contractVersionId: string;
  scheduledPaymentId?: string | null;
  periodLabel: string;
  dueDate: string;
  expectedAmount: number;
  landlordName: string;
  status: PaymentUploadTokenStatus;
  createdAt: string;
  expiresAt: string;
}

export function isTokenUsable(
  doc: Pick<PaymentUploadTokenDoc, "status" | "expiresAt"> | null | undefined,
  nowMs: number,
): boolean {
  if (!doc) return false;
  if (doc.status !== "active") return false; // "used" o "expired" no son utilizables
  const exp = Date.parse(doc.expiresAt ?? "");
  if (Number.isFinite(exp) && exp < nowMs) return false;
  return true;
}

/** Texto corto del estado para mostrar al inquilino. */
export function tokenStateLabel(
  doc: Pick<PaymentUploadTokenDoc, "status" | "expiresAt"> | null | undefined,
  nowMs: number,
): "usable" | "expired" | "used" {
  if (!doc) return "expired";
  if (doc.status === "used") return "used";
  return isTokenUsable(doc, nowMs) ? "usable" : "expired";
}
