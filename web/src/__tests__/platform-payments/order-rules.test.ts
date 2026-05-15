import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCreateOrderIdentity, validatePurchasablePlan } from "@/domain/platform-payments/order-rules";

test("create-order normaliza identidad desde token e ignora identidad cliente", () => {
  const r = normalizeCreateOrderIdentity({
    tokenUserId: "uid_token",
    tokenUserEmail: "user@test.com",
    planCode: "plus",
    leaseProcessId: "lease_1",
    checkoutAmountCop: 49_900,
  });
  assert.equal(r.userId, "uid_token");
  assert.equal(r.userEmail, "user@test.com");
  assert.equal(r.amount, 49900);
  assert.equal(r.currency, "COP");
  assert.equal(r.planCode, "plus");
});

test("plan plus es comprable", () => {
  const r = validatePurchasablePlan("plus");
  assert.equal(r.ok, true);
});

test("plan demo no requiere pago", () => {
  const r = validatePurchasablePlan("basic_demo");
  assert.equal(r.ok, false);
});

test("plan premium no está comprable", () => {
  const r = validatePurchasablePlan("premium_future");
  assert.equal(r.ok, false);
});

