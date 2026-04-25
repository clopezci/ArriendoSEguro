import type { ConsentTexts, SignatureMethod, SignatureRecord } from "./types";

export function buildSignatureEvidence(input: {
  signature: SignatureRecord;
  ipAddress: string;
  userAgent: string;
  signedAt: string;
  consentTexts: ConsentTexts;
  method: SignatureMethod;
}): Record<string, unknown> {
  return {
    signerName: input.signature.signerName,
    signerEmail: input.signature.signerEmail,
    signerDocument: input.signature.signerDocument,
    partyType: input.signature.partyType,
    contractId: input.signature.contractId,
    contractVersionId: input.signature.contractVersionId,
    documentHash: input.signature.documentHash,
    signedAt: input.signedAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    signatureMethod: input.method,
    consentTexts: input.consentTexts,
  };
}

