export type ContractAnnexType =
  | "initial_inventory"
  | "initial_delivery_act"
  | "payment_log"
  | "closing_act"
  | "electronic_signature_evidence"
  | "data_processing_authorizations"
  | "structured_evaluation";

export type ContractAnnexStatus = "pending" | "generated" | "signed" | "voided";

export interface ContractAnnex {
  id: string;
  contractId: string;
  contractVersionId: string;
  leaseProcessId: string;
  annexType: ContractAnnexType;
  title: string;
  status: ContractAnnexStatus;
  htmlContent: string;
  pdfUrl?: string;
  documentHash?: string;
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
}

