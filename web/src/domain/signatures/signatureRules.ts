import type { SignaturePartyType, SignatureRecord, SignatureStatus } from "./types";

export const SIGNATURE_TOKEN_HOURS = 72;

export function requiredParties(hasSolidaryCoDebtor: boolean): SignaturePartyType[] {
  return hasSolidaryCoDebtor
    ? ["landlord", "tenant", "solidaryCoDebtor"]
    : ["landlord", "tenant"];
}

export function isSignatureCompleted(status: SignatureStatus): boolean {
  return status === "signed";
}

export function allRequiredSignaturesCompleted(
  signatures: SignatureRecord[],
  hasSolidaryCoDebtor: boolean,
): boolean {
  const required = requiredParties(hasSolidaryCoDebtor);
  return required.every((party) =>
    signatures.some((s) => s.partyType === party && isSignatureCompleted(s.signatureStatus)),
  );
}

