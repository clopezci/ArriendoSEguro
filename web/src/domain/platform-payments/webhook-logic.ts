import { PLATFORM_PLAN_PLUS_PRICE_COP } from "./plans";

export type WebhookDecision =
  | { kind: "ignore"; reason: string }
  | { kind: "reject"; field: string; message: string; auditEvent?: string }
  | { kind: "duplicate" }
  | { kind: "approve" }
  | { kind: "set_status"; status: "pending" | "rejected" | "cancelled" };

export function decideWebhookHandling(input: {
  eventName?: string;
  amount: number;
  currency: string;
  providerReference: string;
  orderFound: boolean;
  orderPlanCode?: string;
  orderStatus?: string;
  duplicatePayment: boolean;
  transactionStatus?: string;
}): WebhookDecision {
  if (!input.eventName?.toLowerCase().includes("transaction")) {
    return { kind: "ignore", reason: "event_not_transaction" };
  }
  if (!input.providerReference) {
    return { kind: "reject", field: "reference", message: "providerReference ausente." };
  }
  if (!input.orderFound) {
    return { kind: "reject", field: "order", message: "Orden no encontrada para referencia." };
  }
  if (input.orderPlanCode !== "plus") {
    return { kind: "reject", field: "planCode", message: "Solo se procesa Plan Plus." };
  }
  if (input.amount !== PLATFORM_PLAN_PLUS_PRICE_COP) {
    return {
      kind: "reject",
      field: "amount",
      message: "Monto inválido para Plan Plus.",
      auditEvent: "platform_payment_webhook_amount_mismatch",
    };
  }
  if (input.currency !== "COP") {
    return {
      kind: "reject",
      field: "currency",
      message: "Moneda inválida para Plan Plus.",
      auditEvent: "platform_payment_webhook_currency_mismatch",
    };
  }

  const statusLower = (input.transactionStatus ?? "").toLowerCase();
  if (statusLower === "approved") {
    if (input.duplicatePayment || input.orderStatus === "approved") return { kind: "duplicate" };
    return { kind: "approve" };
  }
  if (statusLower === "declined" || statusLower === "error") return { kind: "set_status", status: "rejected" };
  if (statusLower === "voided") return { kind: "set_status", status: "cancelled" };
  return { kind: "set_status", status: "pending" };
}

