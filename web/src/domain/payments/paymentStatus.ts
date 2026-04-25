import type { PaymentStatus } from "./types";

export function computePaymentStatus(input: {
  dueDate: string;
  paidDate?: string;
  amountDue: number;
  amountPaid: number;
  forceDisputed?: boolean;
  hasValidSupport?: boolean;
}): PaymentStatus {
  if (input.forceDisputed) return "disputed";
  if (!input.paidDate) return input.amountPaid > 0 ? "reported_without_support" : "pending";
  if (!input.hasValidSupport) return "pending_support";
  if (input.amountPaid < input.amountDue) return "partial";
  const due = new Date(input.dueDate).getTime();
  const paid = new Date(input.paidDate).getTime();
  if (Number.isFinite(due) && Number.isFinite(paid) && paid > due) return "late";
  return "reported_paid";
}

export function visualPaymentState(input: {
  dueDate: string;
  paidDate?: string;
  amountDue: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
}): "Vencido" | "Pago parcial" | "En revisión" | "Al día" | "Pendiente" {
  if (input.paymentStatus === "disputed") return "En revisión";
  if (input.paymentStatus === "pending_support" || input.paymentStatus === "reported_without_support") return "Pendiente";
  if (input.amountPaid < input.amountDue && input.paidDate) return "Pago parcial";
  const due = new Date(input.dueDate).getTime();
  const now = Date.now();
  if (!input.paidDate && Number.isFinite(due) && due < now) return "Vencido";
  if (input.paymentStatus === "reported_paid" || input.paymentStatus === "late") return "Al día";
  return "Pendiente";
}

