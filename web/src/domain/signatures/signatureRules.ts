import type { SignaturePartyType, SignatureRecord, SignatureStatus } from "./types";

export const SIGNATURE_TOKEN_HOURS = 72;

/** Máximo de codeudores que firman (alineado con `SignaturePartyType`). */
export const MAX_SIGNATURE_CODEBTORS = 5;

/** Acepta el flag booleano (compat) o la cantidad de codeudores. */
function codebtorCountFromArg(arg: boolean | number): number {
  const n = typeof arg === "number" ? Math.floor(arg) : arg ? 1 : 0;
  return Math.max(0, Math.min(MAX_SIGNATURE_CODEBTORS, n));
}

/** Tipo de firmante para el codeudor en posición `index` (0-based). */
export function codebtorPartyType(index: number): SignaturePartyType {
  return (index === 0 ? "solidaryCoDebtor" : `solidaryCoDebtor_${index + 1}`) as SignaturePartyType;
}

/**
 * Partes que deben firmar. Acepta booleano (un codeudor o ninguno) o un número
 * (cantidad de codeudores), de forma compatible con el flujo anterior.
 */
export function requiredParties(codebtors: boolean | number): SignaturePartyType[] {
  const n = codebtorCountFromArg(codebtors);
  const list: SignaturePartyType[] = ["landlord", "tenant"];
  for (let i = 0; i < n; i += 1) list.push(codebtorPartyType(i));
  return list;
}

export function isSignatureCompleted(status: SignatureStatus): boolean {
  return status === "signed";
}

export function allRequiredSignaturesCompleted(
  signatures: SignatureRecord[],
  codebtors: boolean | number,
): boolean {
  const required = requiredParties(codebtors);
  return required.every((party) =>
    signatures.some((s) => s.partyType === party && isSignatureCompleted(s.signatureStatus)),
  );
}

