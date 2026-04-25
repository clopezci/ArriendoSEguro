export type PaymentMethod =
  | "transferencia bancaria"
  | "efectivo con constancia"
  | "consignación"
  | "otro";

export type PaymentStatus =
  | "pending"
  | "reported_paid"
  | "partial"
  | "late"
  | "disputed"
  | "cancelled";

export interface PaymentLog {
  id: string;
  leaseProcessId: string;
  contractId: string;
  contractVersionId: string;
  registeredByUserId: string;
  periodLabel: string;
  dueDate: string;
  paidDate?: string;
  amountDue: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  supportFileUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSupportFile {
  id: string;
  paymentLogId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedByUserId: string;
  uploadedAt: string;
}

