import { randomBytes } from "node:crypto";
import type { SavedLandlordProfile } from "@/domain/saved-entities/savedEntities";

/**
 * Invitación para que un **tercero** (inquilino o codeudor) ingrese sus propios
 * datos en un contrato, validándose por **OTP a su correo** (identidad +
 * consentimiento Habeas Data). El invitado escribe su sección en este doc por
 * token; el dueño luego la **importa** a su borrador. Reutiliza el OTP de firma.
 */
export const PARTY_INVITES_COLLECTION = "party_invites";
export const SAVED_PARTY_PROFILES_COLLECTION = "saved_party_profiles";

/** Días de validez del enlace de invitación. */
export const PARTY_INVITE_TTL_DAYS = 14;

export type PartyRole = "tenant" | "solidaryCoDebtor";
export type PartyInviteStatus = "active" | "completed" | "expired";

export type PartyInviteDoc = {
  token: string;
  contractDraftId: string;
  role: PartyRole;
  inviteeEmail: string;
  inviteeName: string;
  inviterUid: string;
  inviterEmail: string;
  inviterName: string;
  /** Canon mensual del contrato (para validar la solvencia del invitado). */
  monthlyRent?: number;
  /**
   * Índice del codeudor para permitir VARIOS codeudores independientes en un
   * mismo contrato: 0 = codeudor principal (`solidaryCoDebtor`); 1, 2, … =
   * codeudores adicionales (`solidaryCoDebtors[slot-1]`). Solo aplica a
   * role `solidaryCoDebtor`. Ausente = 0 (compatibilidad).
   */
  codebtorSlot?: number;
  /**
   * Documentos que el DUEÑO exige a esta parte (claves del catálogo
   * `requiredDocs`). El enlace muestra una casilla nombrada por cada uno para
   * asegurar que el invitado suba la cantidad requerida.
   */
  requiredDocs?: string[];
  /**
   * Documentos exigidos al CODEUDOR, transportados en el enlace del INQUILINO
   * para que, si el inquilino invita al codeudor, ese enlace herede las casillas
   * requeridas (el dueño sigue siendo la fuente de verdad).
   */
  codebtorRequiredDocs?: string[];
  status: PartyInviteStatus;
  otpHash?: string | null;
  otpExpiresAt?: string | null;
  otpVerifyAttempts?: number;
  otpLastSentAt?: string | null;
  otpVerifiedAt?: string | null;
  contribution?: SavedLandlordProfile | null;
  completedAt?: string | null;
  createdAt: string;
  expiresAt: string;
};

export function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

export function isPartyRole(v: unknown): v is PartyRole {
  return v === "tenant" || v === "solidaryCoDebtor";
}

/** Etiqueta amigable del rol. */
export function partyRoleLabel(role: PartyRole): string {
  return role === "tenant" ? "Arrendatario (inquilino)" : "Codeudor solidario";
}

/** ¿El enlace de invitación sigue siendo usable (activo y no expirado)? */
export function isInviteUsable(doc: PartyInviteDoc | null | undefined, nowMs: number): boolean {
  if (!doc) return false;
  if (doc.status !== "active") return false;
  const exp = Date.parse(doc.expiresAt ?? "");
  if (Number.isFinite(exp) && nowMs > exp) return false;
  return true;
}

/**
 * Igual que `isInviteUsable`, pero también acepta invitaciones **completadas**.
 * Se usa para SUBIR DOCUMENTOS después de que la persona ya envió sus datos (el
 * invite pasó a `completed`): el enlace sigue vigente para adjuntar soportes.
 */
export function isInviteOpenForUpload(doc: PartyInviteDoc | null | undefined, nowMs: number): boolean {
  if (!doc) return false;
  if (doc.status !== "active" && doc.status !== "completed") return false;
  const exp = Date.parse(doc.expiresAt ?? "");
  if (Number.isFinite(exp) && nowMs > exp) return false;
  return true;
}

/** Clave del perfil reutilizable del tercero: por rol + correo normalizado. */
export function savedPartyProfileKey(role: PartyRole, email: string): string {
  return `${role}__${normalizeEmail(email)}`;
}
