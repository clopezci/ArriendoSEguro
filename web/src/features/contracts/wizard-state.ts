"use client";

import type { User } from "firebase/auth";
import { z } from "zod";
import type { ColombianNotificationAddressParts } from "@/domain/colombia/structured-address";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";
import type { PartyDraft } from "@/features/contracts/draft-types";

export type { PartyDraft } from "@/features/contracts/draft-types";
import {
  mergePropertyDraftForValidation,
  partyDraftToPersonParty,
  type PropertyDraftWithParts,
} from "@/features/contracts/party-normalize";

export type AccessStatus = "demo" | "paid" | "pending_payment" | "expired";
export type ContractFlowStatus =
  | "draft"
  | "data_in_progress"
  | "ready_for_preview"
  | "preview_generated"
  | "version_saved"
  | "ready_for_signature";

export type AuditEventName =
  | "contract_flow_started"
  | "access_granted_demo"
  | "access_blocked_pending_payment"
  | "landlord_data_saved"
  | "tenant_data_saved"
  | "codebtor_option_selected"
  | "codebtor_data_saved"
  | "property_data_saved"
  | "rent_cap_validation_failed"
  | "rent_cap_validation_passed"
  | "lease_terms_saved"
  | "utilities_saved"
  | "contract_preview_generated"
  | "contract_draft_saved";

export interface AuditEvent {
  event: AuditEventName;
  at: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface CodebtorExtraConsents {
  dataProcessingConsent: boolean;
  electronicSignatureConsent: boolean;
  solidaryObligationAcceptance: boolean;
}

export interface ContractDraft {
  id: string;
  userId: string;
  isDemo: boolean;
  accessStatusSnapshot: AccessStatus;
  hasSolidaryCoDebtor: boolean;
  contractVersion: string;
  generatedAt: string;
  status: ContractFlowStatus;
  landlord: PartyDraft;
  tenant: PartyDraft;
  solidaryCoDebtor: PartyDraft;
  codebtorConsents: CodebtorExtraConsents;
  property: Partial<ResidentialLeaseContractInput["property"]> & {
    monthlyRentProposed?: number;
    addressParts?: ColombianNotificationAddressParts | null;
  };
  lease: Partial<ResidentialLeaseContractInput["lease"]>;
  utilities: Partial<ResidentialLeaseContractInput["utilities"]>;
  lastUpdatedAt: string;
  auditTrail: AuditEvent[];
}

const DRAFTS_KEY = "arriendoseguro.contract.drafts.v1";
const ACCESS_KEY = "arriendoseguro.contract.access.v1";
const AUDIT_KEY = "arriendoseguro.contract.audit.v1";

export {
  landlordSchema,
  tenantSchema,
  codebtorSchema,
} from "@/features/contracts/party-schemas";

export const propertySchema = z
  .object({
    address: z.string().min(4),
    city: z.string().min(2),
    department: z.string().min(2),
    type: z.string().min(2),
    registryNumber: z.string().min(2),
    commercialValue: z.number().positive(),
    legalRentCap: z.number().positive(),
    monthlyRentProposed: z.number().positive(),
  })
  .superRefine((data, ctx) => {
    if (data.monthlyRentProposed > data.legalRentCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyRentProposed"],
        message:
          "El canon propuesto supera el límite legal estimado para vivienda urbana. Ajusta el valor para continuar.",
      });
    }
  });

export const termsSchema = z.object({
  monthlyRent: z.number().positive(),
  monthlyRentText: z.string().min(4),
  paymentDueDay: z.number().int().min(1).max(31),
  paymentMethod: z.enum([
    "transferencia bancaria",
    "efectivo con constancia",
    "otro medio acordado",
  ]),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  termMonths: z.number().int().positive(),
  latePaymentMonthsThreshold: z.number().int().min(1),
});

export const utilitiesSchema = z.object({
  responsibleParty: z.enum(["arrendatario", "arrendador", "compartido"]),
  details: z.string().min(3),
  adminFeesDetails: z.string().min(3),
});

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getUserAccessStatus(userId: string): AccessStatus {
  const map = readJson<Record<string, { status: AccessStatus; demoExpiresAt?: string }>>(
    ACCESS_KEY,
    {},
  );
  const row = map[userId];
  if (!row) return "pending_payment";
  if (row.status === "demo" && row.demoExpiresAt) {
    const expires = new Date(row.demoExpiresAt).getTime();
    if (Number.isFinite(expires) && expires < Date.now()) {
      map[userId] = { status: "expired" };
      writeJson(ACCESS_KEY, map);
      return "expired";
    }
  }
  return row.status;
}

export function setUserAccessStatus(
  userId: string,
  status: AccessStatus,
  demoDays = 5,
): void {
  const map = readJson<Record<string, { status: AccessStatus; demoExpiresAt?: string }>>(
    ACCESS_KEY,
    {},
  );
  const next: { status: AccessStatus; demoExpiresAt?: string } = { status };
  if (status === "demo") {
    const date = new Date();
    date.setDate(date.getDate() + demoDays);
    next.demoExpiresAt = date.toISOString();
  }
  map[userId] = next;
  writeJson(ACCESS_KEY, map);
}

export function logGlobalAudit(
  event: AuditEventName,
  metadata?: AuditEvent["metadata"],
): void {
  const list = readJson<AuditEvent[]>(AUDIT_KEY, []);
  list.unshift({ event, at: new Date().toISOString(), metadata });
  writeJson(AUDIT_KEY, list.slice(0, 500));
}

export function canCreateContract(user: User | null, accessStatus: AccessStatus): {
  allowed: boolean;
  reason?: "not_authenticated" | "pending_payment" | "expired";
} {
  if (!user) return { allowed: false, reason: "not_authenticated" };
  if (accessStatus === "demo" || accessStatus === "paid") return { allowed: true };
  if (accessStatus === "pending_payment") return { allowed: false, reason: "pending_payment" };
  return { allowed: false, reason: "expired" };
}

export function getAllDrafts(): ContractDraft[] {
  return readJson<ContractDraft[]>(DRAFTS_KEY, []);
}

export function getDraft(id: string): ContractDraft | null {
  return getAllDrafts().find((d) => d.id === id) ?? null;
}

export function saveAllDrafts(drafts: ContractDraft[]): void {
  writeJson(DRAFTS_KEY, drafts);
}

export function appendAudit(
  draft: ContractDraft,
  event: AuditEventName,
  metadata?: AuditEvent["metadata"],
): ContractDraft {
  return {
    ...draft,
    auditTrail: [...draft.auditTrail, { event, at: new Date().toISOString(), metadata }],
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function saveDraft(draft: ContractDraft): ContractDraft {
  const drafts = getAllDrafts();
  const i = drafts.findIndex((d) => d.id === draft.id);
  if (i >= 0) drafts[i] = draft;
  else drafts.unshift(draft);
  saveAllDrafts(drafts);
  return draft;
}

function createId(): string {
  return `ct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createContractDraft(input: {
  userId: string;
  accessStatus: AccessStatus;
  isDemo: boolean;
}): ContractDraft {
  const now = new Date().toISOString();
  const draft: ContractDraft = {
    id: createId(),
    userId: input.userId,
    accessStatusSnapshot: input.accessStatus,
    isDemo: input.isDemo,
    hasSolidaryCoDebtor: false,
    contractVersion: "AS-LEASE-MVP-2026.1",
    generatedAt: now,
    status: "draft",
    landlord: {},
    tenant: {},
    solidaryCoDebtor: {},
    codebtorConsents: {
      dataProcessingConsent: false,
      electronicSignatureConsent: false,
      solidaryObligationAcceptance: false,
    },
    property: {},
    lease: { latePaymentMonthsThreshold: 2, paymentMethod: "transferencia bancaria" },
    utilities: {},
    lastUpdatedAt: now,
    auditTrail: [{ event: "contract_flow_started", at: now }],
  };
  return saveDraft(draft);
}

export function updateDraft(
  draftId: string,
  updater: (draft: ContractDraft) => ContractDraft,
): ContractDraft | null {
  const current = getDraft(draftId);
  if (!current) return null;
  const next = updater({
    ...current,
    lastUpdatedAt: new Date().toISOString(),
  });
  return saveDraft(next);
}

export function toContractInput(draft: ContractDraft): ResidentialLeaseContractInput {
  const mergedProp = mergePropertyDraftForValidation(draft.property as PropertyDraftWithParts);
  return {
    landlord: partyDraftToPersonParty(draft.landlord),
    tenant: partyDraftToPersonParty(draft.tenant),
    solidaryCoDebtor: draft.hasSolidaryCoDebtor
      ? partyDraftToPersonParty(draft.solidaryCoDebtor)
      : undefined,
    property: {
      address: mergedProp.address ?? "",
      city: mergedProp.city ?? "",
      department: mergedProp.department ?? "",
      type: mergedProp.type ?? "",
      registryNumber: mergedProp.registryNumber ?? "",
      commercialValue: Number(mergedProp.commercialValue ?? 0),
      legalRentCap: Number(mergedProp.legalRentCap ?? 0),
    },
    lease: {
      monthlyRent: Number(draft.lease.monthlyRent ?? 0),
      monthlyRentText: draft.lease.monthlyRentText ?? "",
      paymentDueDay: Number(draft.lease.paymentDueDay ?? 1),
      paymentMethod: draft.lease.paymentMethod ?? "transferencia bancaria",
      startDate: draft.lease.startDate ?? "",
      endDate: draft.lease.endDate ?? "",
      termMonths: Number(draft.lease.termMonths ?? 0),
      latePaymentMonthsThreshold: Number(draft.lease.latePaymentMonthsThreshold ?? 2),
    },
    utilities: {
      responsibleParty: draft.utilities.responsibleParty ?? "",
      details: draft.utilities.details ?? "",
      adminFeesDetails: draft.utilities.adminFeesDetails ?? "",
    },
    hasSolidaryCoDebtor: draft.hasSolidaryCoDebtor,
    contractVersion: draft.contractVersion,
    generatedAt: draft.generatedAt,
  };
}

