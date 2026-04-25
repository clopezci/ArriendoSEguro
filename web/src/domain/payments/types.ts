export type PaymentMethod =
  | "transferencia bancaria"
  | "efectivo con constancia"
  | "consignación"
  | "otro";

export type PaymentStatus =
  | "pending"
  | "pending_support"
  | "reported_without_support"
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
  supportFileName?: string;
  supportFileType?: string;
  supportFileSize?: number;
  supportUploadedAt?: string;
  reportedByUserId?: string;
  reportedByEmail?: string;
  reportedByRole?: "landlord" | "tenant" | "solidaryCoDebtor";
  reportedAt?: string;
  supportRequired?: boolean;
  supportValidationStatus?: "pending" | "valid" | "invalid";
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

export type ScheduledPaymentStatus =
  | "scheduled"
  | "pending"
  | "pending_support"
  | "reported_paid"
  | "partial"
  | "late"
  | "disputed"
  | "cancelled";

export type ReminderStatus = "not_scheduled" | "scheduled" | "sent" | "failed" | "disabled";

export interface ScheduledPayment {
  id: string;
  leaseProcessId: string;
  contractId: string;
  contractVersionId: string;
  periodNumber: number;
  periodLabel: string;
  dueDate: string;
  expectedAmount: number;
  status: ScheduledPaymentStatus;
  paymentLogId?: string;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  reminderEmailTo: string;
  reminderLastSentAt?: string;
  reminderStatus: ReminderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReminderSettings {
  id: string;
  leaseProcessId: string;
  contractId: string;
  enabled: boolean;
  defaultDaysBefore: number;
  tenantEmail: string;
  landlordCopyEnabled: boolean;
  landlordEmail?: string;
  customMessage?: string;
  createdAt: string;
  updatedAt: string;
}


