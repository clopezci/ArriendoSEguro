import type { ContractAnnex, ContractAnnexType } from "./types";

export type AnnexValidationIssue = { field: string; message: string };

export function validateAnnexData(input: Partial<ContractAnnex>): AnnexValidationIssue[] {
  const issues: AnnexValidationIssue[] = [];
  if (!input.contractId) issues.push({ field: "contractId", message: "contractId es obligatorio." });
  if (!input.contractVersionId) {
    issues.push({ field: "contractVersionId", message: "contractVersionId es obligatorio." });
  }
  if (!input.leaseProcessId) {
    issues.push({ field: "leaseProcessId", message: "leaseProcessId es obligatorio." });
  }
  if (!input.annexType) issues.push({ field: "annexType", message: "annexType es obligatorio." });
  if (!input.title) issues.push({ field: "title", message: "title es obligatorio." });
  return issues;
}

export function isPlaceholderAnnexType(annexType: ContractAnnexType): boolean {
  return (
    annexType === "initial_inventory" ||
    annexType === "initial_delivery_act" ||
    annexType === "electronic_signature_evidence"
  );
}

