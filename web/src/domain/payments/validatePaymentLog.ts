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
});

export const markDisputedSchema = z.object({
  paymentLogId: z.string().min(3),
  reason: z.string().min(3),
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

