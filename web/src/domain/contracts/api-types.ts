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
});

export const contractPreviewRequestSchema = z.object({
  contractPayload: payloadSchema,
});

export type ContractPreviewRequest = {
  contractPayload: ResidentialLeaseContractInput;
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
      }>;
    }
  | { success: false; errors: { field: string; message: string }[] };

export const completeSignatureRequestSchema = z.object({
  token: z.string().min(20),
  consentAccepted: z.literal(true),
  electronicSignatureAccepted: z.literal(true),
});

export type CompleteSignatureResponse =
  | { success: true; signatureStatus: "signed"; contractStatus: string }
  | { success: false; errors: { field: string; message: string }[] };

export type ContractLifecycleStatus =
  | "draft"
  | "ready_for_review"
  | "ready_for_signature"
  | "signed"
  | "voided";

