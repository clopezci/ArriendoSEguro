import type { PartyRole } from "@/domain/party-invite/partyInvite";

/**
 * Documentos (soportes) que sube el invitado (inquilino/codeudor) desde su
 * enlace de invitación, con validación de identidad por OTP. Reutiliza el mismo
 * patrón de subida por token que los comprobantes de pago (`/pago/[token]`):
 * URL firmada de Storage → PUT → confirmación con verificación de magic bytes.
 */
export const PARTY_INVITE_SUPPORTS_COLLECTION = "party_invite_supports";

/** Máximo de documentos por parte (inquilino o codeudor) en un mismo contrato. */
export const PARTY_INVITE_SUPPORT_MAX_PER_PARTY = 12;

/** Prefijo de la ruta en Storage para los soportes de una parte en un contrato. */
export function inviteSupportStoragePrefix(contractDraftId: string, role: PartyRole): string {
  return `contracts/${contractDraftId}/invite-supports/${role}/`;
}

export type InviteSupportRow = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
};
