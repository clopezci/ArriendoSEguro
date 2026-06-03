import { z } from "zod";
import type { ResidentialLeaseContractInput, ValidationIssue } from "./types";

const personSchema = z.object({
  fullName: z.string(),
  documentType: z.string(),
  documentNumber: z.string(),
  city: z.string(),
  email: z.string(),
  phone: z.string(),
  notificationAddress: z.string(),
});

// Campos opcionales agregados en la iteración de "ajustes adicionales del
// contrato y flujo". Se mantienen opcionales para no romper expedientes
// existentes (AS-LEASE-MVP-2026.1) y permitir que el servidor reciba
// `commercialValueUnknown`, declaración bajo juramento del inmueble,
// cláusulas especiales y observaciones del expediente sin ser strippeados
// por Zod (lo cual rompía la validación condicional del 1%).
const specialClausesSchema = z.object({
  enabled: z.boolean(),
  selected: z.array(z.string()).default([]),
  freeText: z.string().optional(),
  costNotified: z.boolean(),
});

const notarizationSchema = z.object({
  wantsNotarization: z.boolean(),
  uploadedDocumentRef: z.string().optional(),
  uploadedAt: z.string().optional(),
});

const creditCheckSchema = z.object({
  wantsCreditCheck: z.boolean().optional(),
  scope: z.array(z.enum(["TENANT", "CODEBTOR"])).optional(),
  partnerSlug: z.string().optional(),
  landlordVerifiedTenantCreditHistory: z.enum(["yes", "no"]).optional(),
  landlordVerifiedCodebtorCreditHistory: z.enum(["yes", "no"]).optional(),
});

const payloadSchema = z.object({
  landlord: personSchema,
  tenant: personSchema,
  solidaryCoDebtor: personSchema.optional(),
  property: z.object({
    address: z.string(),
    city: z.string(),
    department: z.string(),
    type: z.string(),
    registryNumber: z.string(),
    commercialValue: z.number(),
    legalRentCap: z.number(),
    commercialValueUnknown: z.boolean().optional(),
    noCapAcknowledgement: z.boolean().optional(),
    ownershipDeclaration: z
      .object({
        truthfulInfoOath: z.boolean(),
        ownerOrAuthorized: z.boolean(),
        acceptedAt: z.string().optional(),
      })
      .optional(),
  }),
  lease: z.object({
    monthlyRent: z.number(),
    monthlyRentText: z.string(),
    paymentDueDay: z.number(),
    paymentMethod: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    termMonths: z.number(),
    latePaymentMonthsThreshold: z.number(),
  }),
  utilities: z.object({
    responsibleParty: z.string(),
    details: z.string(),
    adminFeesDetails: z.string(),
  }),
  hasSolidaryCoDebtor: z.boolean(),
  contractVersion: z.string(),
  generatedAt: z.string(),
  contractType: z
    .enum(["VIVIENDA_URBANA", "VIVIENDA_RURAL", "HABITACION", "COMERCIAL", "RURAL_PRODUCTIVO"])
    .optional(),
  specialClauses: specialClausesSchema.optional(),
  notarization: notarizationSchema.optional(),
  creditCheck: creditCheckSchema.optional(),
  expedienteNotes: z.string().optional(),
});

export const contractPreviewRequestSchema = z.object({
  contractPayload: payloadSchema,
  isDemo: z.boolean().optional(),
});

export type ContractPreviewRequest = {
  contractPayload: ResidentialLeaseContractInput;
  isDemo?: boolean;
};

export type ContractPreviewResponse =
  | {
      success: true;
      html: string;
      validationErrors: [];
      contractVersionDraft: {
        versionNumber: number;
        generatedAt: string;
        documentHash: string;
        hasSolidaryCoDebtor: boolean;
      };
    }
  | {
      success: false;
      html: null;
      validationErrors: ValidationIssue[];
      contractVersionDraft: null;
      message?: string;
    };

export const saveDraftVersionRequestSchema = z.object({
  contractDraftId: z.string().min(3),
  contractPayload: payloadSchema,
  html: z.string().min(10),
  documentHash: z.string().min(6),
  hasSolidaryCoDebtor: z.boolean(),
  generatedAt: z.string(),
  /** Preferencia de recordatorios de vencimiento (no legal). Opcional. */
  renewalReminderEnabled: z.boolean().optional(),
});

export type SaveDraftVersionRequest = z.infer<typeof saveDraftVersionRequestSchema>;

export type SaveDraftVersionResponse =
  | {
      success: true;
      contractId: string;
      contractVersionId: string;
      versionNumber: number;
      documentHash: string;
      status: "draft";
    }
  | {
      success: false;
      errors: { field: string; message: string }[];
    };

export const generateContractPdfRequestSchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
});

export type GenerateContractPdfRequest = z.infer<typeof generateContractPdfRequestSchema>;

export type GenerateContractPdfResponse =
  | {
      success: true;
      pdfUrl: string;
      contractId: string;
      contractVersionId: string;
      versionNumber: number;
      documentHash: string;
      pdfGeneratedAt: string;
    }
  | {
      success: false;
      errors: { field: string; message: string }[];
    };

export const startSignatureRequestSchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
});

export type StartSignatureResponse =
  | {
      success: true;
      signatures: Array<{
        partyType: "landlord" | "tenant" | "solidaryCoDebtor";
        signerEmail: string;
        signatureStatus: "pending" | "sent" | "opened" | "signed" | "expired" | "cancelled" | "failed";
        tokenExpiresAt: string;
        sentAt: string;
        /** Resultado del envío de la invitación al iniciar la ronda (Resend / mock). */
        emailMode?: "real" | "mock" | "failed" | "skipped";
      }>;
    }
  | { success: false; errors: { field: string; message: string }[] };

export const completeSignatureRequestSchema = z.object({
  token: z.string().min(20),
  consentAccepted: z.literal(true),
  electronicSignatureAccepted: z.literal(true),
});

export const signatureRequestOtpSchema = z.object({
  token: z.string().min(20),
});

export const signatureVerifyOtpSchema = z.object({
  token: z.string().min(20),
  code: z.string().regex(/^\d{6}$/, "El código debe ser de 6 dígitos."),
});

export type SignatureOtpResponse =
  | { success: true; message?: string }
  | { success: false; errors: { field: string; message: string }[] };

export type CompleteSignatureResponse =
  | {
      success: true;
      signatureStatus: "signed";
      contractStatus: string;
      /** Solo cuando el contrato queda totalmente firmado y se intentó avisar por correo a las partes. */
      partyEmailDelivery?: "ok" | "partial" | "failed";
    }
  | { success: false; errors: { field: string; message: string }[] };

export type ContractLifecycleStatus =
  | "draft"
  | "ready_for_review"
  | "ready_for_signature"
  | "signed"
  | "voided";

/** Metadatos del formulario multipart de carga notarial (Bloque 9). */
export const notarialUploadIdsSchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
});

