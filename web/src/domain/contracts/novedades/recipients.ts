import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";
import type { ContractParticipantRole } from "@/lib/auth/serverAuth";

/**
 * Correos de las demás partes del contrato (contraparte y codeudor si aplica),
 * excluyendo al autor de la novedad.
 */
export function resolveNovedadRecipientEmails(
  payload: ResidentialLeaseContractInput | undefined,
  hasSolidaryCoDebtor: boolean,
  authorEmail: string,
  _authorRole: ContractParticipantRole,
): string[] {
  const author = authorEmail.trim().toLowerCase();
  const land = (payload?.landlord?.email ?? "").trim().toLowerCase();
  const ten = (payload?.tenant?.email ?? "").trim().toLowerCase();
  const co = (payload?.solidaryCoDebtor?.email ?? "").trim().toLowerCase();

  const candidates: string[] = [];
  if (land) candidates.push(land);
  if (ten) candidates.push(ten);
  if (hasSolidaryCoDebtor && co) candidates.push(co);

  const unique = Array.from(new Set(candidates.filter((e) => e && e !== author)));
  if (unique.length > 0) return unique;

  return [];
}
