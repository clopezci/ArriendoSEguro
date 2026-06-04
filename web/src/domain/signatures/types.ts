export type SignaturePartyType =
  | "landlord"
  | "tenant"
  | "solidaryCoDebtor"
  | "solidaryCoDebtor_2"
  | "solidaryCoDebtor_3"
  | "solidaryCoDebtor_4"
  | "solidaryCoDebtor_5";

export type SignatureStatus =
  | "pending"
  | "sent"
  | "opened"
  | "signed"
  | "expired"
  | "cancelled"
  | "failed";

export type SignatureMethod = "email_link";

export interface SignatureRecord {
  id: string;
  contractId: string;
  contractVersionId: string;
  leaseProcessId: string;
  leasePartyId: string;
  partyType: SignaturePartyType;
  signerName: string;
  signerEmail: string;
  signerDocument: string;
  signatureStatus: SignatureStatus;
  signatureMethod: SignatureMethod;
  tokenHash: string;
  tokenExpiresAt: string;
  /** OTP por correo (Bloque 7): hash del código vigente; se borra al validar. */
  signatureOtpHash?: string | null;
  signatureOtpExpiresAt?: string | null;
  signatureOtpVerifyAttempts?: number;
  signatureOtpLastSentAt?: string | null;
  /** Cuando el firmante validó el OTP correctamente. */
  otpVerifiedAt?: string | null;
  /** Correo en el que se validó el OTP (trazabilidad). */
  otpEmailAtVerification?: string | null;
  consentAccepted: boolean;
  consentAcceptedAt?: string;
  signedAt?: string;
  sentAt?: string;
  ipAddress?: string;
  userAgent?: string;
  documentHash: string;
  evidenceJson?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ConsentTexts = {
  contractReadingAcceptance:
    "Declaro que he leído el contrato, entiendo su contenido y acepto firmarlo electrónicamente.";
  electronicSignatureAcceptance:
    "Acepto el uso de firma electrónica simple para este contrato.";
};

