import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

/**
 * Correos de las demás partes del contrato (contraparte y codeudor si aplica),
 * excluyendo al autor de la novedad.
 */
export function resolveNovedadRecipientEmails(
  payload: ResidentialLeaseContractInput | undefined,
  hasSolidaryCoDebtor: boolean,
  authorEmail: string,
): string[] {
  const author = authorEmail.trim().toLowerCase();
  const land = (payload?.landlord?.email ?? "").trim().toLowerCase();
  const ten = (payload?.tenant?.email ?? "").trim().toLowerCase();

  const candidates: string[] = [];
  if (land) candidates.push(land);
  if (ten) candidates.push(ten);

  // Codeudores: prioriza la lista completa; cae al singular (compat).
  const list = payload?.solidaryCoDebtors;
  const codebtors =
    list && list.length > 0
      ? list
      : hasSolidaryCoDebtor && payload?.solidaryCoDebtor
        ? [payload.solidaryCoDebtor]
        : [];
  for (const c of codebtors) {
    const email = (c?.email ?? "").trim().toLowerCase();
    if (email) candidates.push(email);
  }

  const unique = Array.from(new Set(candidates.filter((e) => e && e !== author)));
  if (unique.length > 0) return unique;

  return [];
}
