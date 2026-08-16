import type { ConsentTexts, SignatureMethod, SignatureRecord } from "./types";

export function buildSignatureEvidence(input: {
  signature: SignatureRecord;
  ipAddress: string;
  userAgent: string;
  signedAt: string;
  consentTexts: ConsentTexts;
  method: SignatureMethod;
  /** Bloque 7: reforzamiento con OTP y hash del bloque de consentimientos mostrado. */
  otpVerifiedAt?: string;
  otpEmail?: string;
  consentBlockHash?: string;
  /**
   * Cómo se reforzó la identidad del firmante: "otp_email" (enlace + código al
   * correo) o "authenticated_session" (dueño firmando en su sesión de la app).
   */
  reinforcement?: "otp_email" | "authenticated_session";
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
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
    signatureReinforcement: input.reinforcement ?? "otp_email",
  };
  if (input.otpVerifiedAt) base.otpVerifiedAt = input.otpVerifiedAt;
  if (input.otpEmail) base.otpEmail = input.otpEmail;
  if (input.consentBlockHash) base.consentBlockHash = input.consentBlockHash;
  return base;
}

