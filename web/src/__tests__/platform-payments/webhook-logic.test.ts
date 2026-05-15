import test from "node:test";
import assert from "node:assert/strict";
import { decideWebhookHandling } from "@/domain/platform-payments/webhook-logic";

test("webhook inválido por monto incorrecto", () => {
  const d = decideWebhookHandling({
    eventName: "transaction.updated",
    amount: 1000,
    expectedOrderAmountCop: 49_900,
    currency: "COP",
    providerReference: "AS_PLUS_1",
    orderFound: true,
    orderPlanCode: "plus",
    duplicatePayment: false,
    transactionStatus: "APPROVED",
  });
  assert.equal(d.kind, "reject");
  if (d.kind === "reject") assert.equal(d.field, "amount");
});

test("webhook inválido por moneda distinta", () => {
  const d = decideWebhookHandling({
    eventName: "transaction.updated",
    amount: 49900,
    expectedOrderAmountCop: 49_900,
    currency: "USD",
    providerReference: "AS_PLUS_1",
    orderFound: true,
    orderPlanCode: "plus",
    duplicatePayment: false,
    transactionStatus: "APPROVED",
  });
  assert.equal(d.kind, "reject");
  if (d.kind === "reject") assert.equal(d.field, "currency");
});

test("webhook aprobado válido", () => {
  const d = decideWebhookHandling({
    eventName: "transaction.updated",
    amount: 49900,
    expectedOrderAmountCop: 49_900,
    currency: "COP",
    providerReference: "AS_PLUS_1",
    orderFound: true,
    orderPlanCode: "plus",
    orderStatus: "pending",
    duplicatePayment: false,
    transactionStatus: "APPROVED",
  });
  assert.equal(d.kind, "approve");
});

test("webhook aprobado duplicado se ignora idempotente", () => {
  const d = decideWebhookHandling({
    eventName: "transaction.updated",
    amount: 49900,
    expectedOrderAmountCop: 49_900,
    currency: "COP",
    providerReference: "AS_PLUS_1",
    orderFound: true,
    orderPlanCode: "plus",
    orderStatus: "approved",
    duplicatePayment: true,
    transactionStatus: "APPROVED",
  });
  assert.equal(d.kind, "duplicate");
});

test("webhook declined marca rejected", () => {
  const d = decideWebhookHandling({
    eventName: "transaction.updated",
    amount: 49900,
    expectedOrderAmountCop: 49_900,
    currency: "COP",
    providerReference: "AS_PLUS_1",
    orderFound: true,
    orderPlanCode: "plus",
    duplicatePayment: false,
    transactionStatus: "DECLINED",
  });
  assert.equal(d.kind, "set_status");
  if (d.kind === "set_status") assert.equal(d.status, "rejected");
});

