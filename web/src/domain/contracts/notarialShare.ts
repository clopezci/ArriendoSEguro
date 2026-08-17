import { randomBytes } from "node:crypto";

/**
 * Enlace para que UNA parte (típicamente el inquilino) firme y autentique el
 * contrato con la firma digital gratuita del Estado (Agencia Nacional Digital) y
 * **suba el PDF firmado** al contrato SIN necesidad de cuenta. El dueño genera el
 * enlace y se lo comparte (p. ej. por su propio WhatsApp). El token autoriza solo
 * dos acciones acotadas sobre esa versión del contrato: descargar el PDF del
 * contrato y subir el PDF autenticado.
 */
export const NOTARIAL_SHARES_COLLECTION = "notarial_shares";

/** Días de validez del enlace. */
export const NOTARIAL_SHARE_TTL_DAYS = 14;

export type NotarialShareRole = "tenant" | "solidaryCoDebtor";
export type NotarialShareStatus = "active" | "expired";

export type NotarialShareDoc = {
  token: string;
  contractId: string;
  contractVersionId: string;
  role: NotarialShareRole;
  inviteeName: string;
  inviteePhone: string;
  propertyLabel: string;
  inviterUid: string;
  inviterEmail: string;
  status: NotarialShareStatus;
  /** Última subida hecha con este enlace (anexo notarial). */
  lastUploadedAnnexId?: string | null;
  lastUploadedAt?: string | null;
  createdAt: string;
  expiresAt: string;
};

export function newNotarialShareToken(): string {
  return randomBytes(24).toString("hex");
}

/** ¿El enlace sigue siendo usable (activo y no expirado)? */
export function isNotarialShareUsable(doc: NotarialShareDoc | null | undefined, nowMs: number): boolean {
  if (!doc) return false;
  if (doc.status !== "active") return false;
  const exp = Date.parse(doc.expiresAt ?? "");
  if (Number.isFinite(exp) && nowMs > exp) return false;
  return true;
}

export function notarialShareRoleLabel(role: NotarialShareRole): string {
  return role === "tenant" ? "Arrendatario (inquilino)" : "Codeudor solidario";
}
