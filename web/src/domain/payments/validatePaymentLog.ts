import { z } from "zod";

export const paymentCreateSchema = z.object({
  leaseProcessId: z.string().min(3),
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  periodLabel: z.string().min(3),
  dueDate: z.string().min(8),
  paidDate: z.string().optional(),
  amountDue: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
  paymentMethod: z.enum([
    "transferencia bancaria",
    "efectivo con constancia",
    "consignación",
    "otro",
  ]),
  notes: z.string().optional(),
  supportFileUrl: z.string().optional(),
  supportFileName: z.string().optional(),
  supportFileType: z.string().optional(),
  supportFileSize: z.number().int().positive().optional(),
  scheduledPaymentId: z.string().optional(),
  reportedByUserId: z.string().min(3),
  reportedByRole: z.enum(["landlord", "tenant", "solidaryCoDebtor"]),
  reportedByEmail: z.string().email(),
});

export const paymentUpdateSchema = z.object({
  paymentLogId: z.string().min(3),
  periodLabel: z.string().min(3).optional(),
  dueDate: z.string().min(8).optional(),
  paidDate: z.string().optional(),
  amountDue: z.number().nonnegative().optional(),
  amountPaid: z.number().nonnegative().optional(),
  paymentMethod: z
    .enum(["transferencia bancaria", "efectivo con constancia", "consignación", "otro"])
    .optional(),
  notes: z.string().optional(),
  supportFileUrl: z.string().optional(),
  supportFileName: z.string().optional(),
  supportFileType: z.string().optional(),
  supportFileSize: z.number().int().positive().optional(),
});

export const markDisputedSchema = z.object({
  paymentLogId: z.string().min(3),
  reason: z.string().min(3),
});

export const scheduleGenerateSchema = z.object({
  leaseProcessId: z.string().min(3),
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  reminderSettings: z
    .object({
      enabled: z.boolean().optional(),
      defaultDaysBefore: z.number().int().positive().optional(),
      tenantEmail: z.string().email().optional(),
      landlordCopyEnabled: z.boolean().optional(),
      landlordEmail: z.string().email().optional(),
      customMessage: z.string().optional(),
    })
    .optional(),
});

export const scheduleSettingsSchema = z.object({
  leaseProcessId: z.string().min(3),
  contractId: z.string().min(3),
  enabled: z.boolean(),
  defaultDaysBefore: z.number().int().positive(),
  tenantEmail: z.string().email(),
  landlordCopyEnabled: z.boolean(),
  landlordEmail: z.string().email().optional(),
  customMessage: z.string().optional(),
});

export const updateScheduledOneSchema = z.object({
  scheduledPaymentId: z.string().min(3),
  dueDate: z.string().optional(),
  expectedAmount: z.number().nonnegative().optional(),
  reminderEnabled: z.boolean().optional(),
  reminderDaysBefore: z.number().int().positive().optional(),
  status: z
    .enum(["scheduled", "pending", "pending_support", "reported_paid", "partial", "late", "disputed", "cancelled"])
    .optional(),
});

export function validatePaymentBusinessRules(input: {
  amountDue: number;
  amountPaid: number;
}): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  if (input.amountDue < 0 || input.amountPaid < 0) {
    issues.push({ field: "amount", message: "No se permiten valores negativos." });
  }
  if (input.amountPaid > input.amountDue) {
    issues.push({
      field: "amountPaid",
      message: "El valor pagado supera el valor esperado. Verifica si corresponde.",
    });
  }
  return issues;
}

