import test from "node:test";
import assert from "node:assert/strict";
import { POST as createOrderPOST } from "@/app/api/platform-payments/create-order/route";
import { POST as mockApprovePOST } from "@/app/api/platform-payments/mock-approve/route";
import { GET as orderStatusGET } from "@/app/api/platform-payments/order-status/route";
import { POST as demoStartPOST } from "@/app/api/access/demo/start/route";
import { POST as consumePlusPOST } from "@/app/api/access/contracts/consume-plus/route";
import { POST as webhookPOST } from "@/app/api/platform-payments/webhook/route";
import { createMockFirestore } from "./mockFirestore";
import { clearFirebaseAuthMock, installFirebaseAuthMock } from "./mockFirebaseAuth";
import { jsonGet, jsonPost } from "./mockRequest";
import { makeWompiEvent } from "./mockWompiEvent";
import { makePlatformOrder, tokens, users } from "./testDataFactory";

function setup() {
  const firestore = createMockFirestore();
  globalThis.__TEST_FIRESTORE__ = firestore as never;
  installFirebaseAuthMock({
    [tokens.owner]: users.owner,
    [tokens.other]: users.other,
  });
  return firestore;
}

function cleanup() {
  clearFirebaseAuthMock();
  globalThis.__TEST_FIRESTORE__ = undefined;
}

test("1) create-order sin token responde 401 y no crea orden", async () => {
  const firestore = setup();
  const res = await createOrderPOST(jsonPost("http://t/api/platform-payments/create-order", { planCode: "plus" }));
  assert.equal(res.status, 401);
  assert.equal(firestore.all("platform_orders").length, 0);
  cleanup();
});

test("2) create-order plus usa identidad del token y crea orden", async () => {
  const firestore = setup();
  const res = await createOrderPOST(
    jsonPost(
      "http://t/api/platform-payments/create-order",
      { planCode: "plus", userId: "attacker_uid", userEmail: "attacker@test.com" },
      tokens.owner,
    ),
  );
  assert.equal(res.status, 200);
  const orders = firestore.all("platform_orders");
  assert.equal(orders.length, 1);
  const order = orders[0] as { amount: number; currency: string; planCode: string; userId: string; userEmail: string; status: string };
  assert.equal(order.amount, 39900);
  assert.equal(order.currency, "COP");
  assert.equal(order.planCode, "plus");
  assert.equal(order.userId, users.owner.uid);
  assert.equal(order.userEmail, users.owner.email);
  assert.equal(order.status, "pending");
  const events = firestore.all("audit_logs").map((a) => (a as { event?: string }).event);
  assert.ok(events.includes("platform_order_created"));
  cleanup();
});

test("3) create-order con plan distinto de plus falla", async () => {
  const firestore = setup();
  const premiumRes = await createOrderPOST(
    jsonPost("http://t/api/platform-payments/create-order", { planCode: "premium_future" }, tokens.owner),
  );
  const demoRes = await createOrderPOST(
    jsonPost("http://t/api/platform-payments/create-order", { planCode: "basic_demo" }, tokens.owner),
  );
  assert.equal(premiumRes.status, 422);
  assert.equal(demoRes.status, 422);
  assert.equal(firestore.all("platform_orders").length, 0);
  cleanup();
});

test("4) mock-approve dueño aprueba orden y crea payment+entitlement", async () => {
  const firestore = setup();
  const order = makePlatformOrder({ id: "order_approve_1", userId: users.owner.uid, userEmail: users.owner.email });
  firestore.seed("platform_orders", order.id, order);
  const res = await mockApprovePOST(jsonPost("http://t/api/platform-payments/mock-approve", { orderId: order.id }, tokens.owner));
  assert.equal(res.status, 200);
  const updatedOrder = firestore.all("platform_orders")[0] as { status: string };
  assert.equal(updatedOrder.status, "approved");
  const payments = firestore.all("platform_payments");
  const entitlements = firestore.all("access_entitlements");
  assert.equal(payments.length, 1);
  assert.equal(entitlements.length, 1);
  const e = entitlements[0] as { planCode: string; accessType: string; maxContractsAllowed: number; contractsUsed: number; status: string };
  assert.equal(e.planCode, "plus");
  assert.equal(e.accessType, "plus_paid");
  assert.equal(e.maxContractsAllowed, 1);
  assert.equal(e.contractsUsed, 0);
  assert.equal(e.status, "active");
  const events = firestore.all("audit_logs").map((a) => (a as { event?: string }).event);
  assert.ok(events.includes("platform_payment_mock_approved"));
  cleanup();
});

test("5) mock-approve usuario diferente responde 403 sin entitlement", async () => {
  const firestore = setup();
  const order = makePlatformOrder({ id: "order_approve_2", userId: users.owner.uid });
  firestore.seed("platform_orders", order.id, order);
  const res = await mockApprovePOST(jsonPost("http://t/api/platform-payments/mock-approve", { orderId: order.id }, tokens.other));
  assert.equal(res.status, 403);
  assert.equal(firestore.all("platform_payments").length, 0);
  assert.equal(firestore.all("access_entitlements").length, 0);
  cleanup();
});

test("6) order-status dueño obtiene estado", async () => {
  const firestore = setup();
  const order = makePlatformOrder({ id: "order_status_1", userId: users.owner.uid, status: "pending" });
  firestore.seed("platform_orders", order.id, order);
  const res = await orderStatusGET(jsonGet(`http://t/api/platform-payments/order-status?orderId=${order.id}`, tokens.owner));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { success: boolean; order?: { id?: string } };
  assert.equal(body.success, true);
  assert.equal(body.order?.id, order.id);
  cleanup();
});

test("7) order-status usuario diferente responde 403", async () => {
  const firestore = setup();
  const order = makePlatformOrder({ id: "order_status_2", userId: users.owner.uid, status: "pending" });
  firestore.seed("platform_orders", order.id, order);
  const res = await orderStatusGET(jsonGet(`http://t/api/platform-payments/order-status?orderId=${order.id}`, tokens.other));
  assert.equal(res.status, 403);
  cleanup();
});

test("8) demo/start crea entitlement demo", async () => {
  const firestore = setup();
  const res = await demoStartPOST(jsonPost("http://t/api/access/demo/start", {}, tokens.owner));
  assert.equal(res.status, 200);
  const e = firestore.all("access_entitlements")[0] as { planCode: string; accessType: string; maxContractsAllowed: number };
  assert.equal(e.planCode, "basic_demo");
  assert.equal(e.accessType, "demo");
  assert.equal(e.maxContractsAllowed, 0);
  cleanup();
});

test("9) crear expediente real solo con demo bloquea (consume-plus 403)", async () => {
  const firestore = setup();
  await demoStartPOST(jsonPost("http://t/api/access/demo/start", {}, tokens.owner));
  const res = await consumePlusPOST(jsonPost("http://t/api/access/contracts/consume-plus", {}, tokens.owner));
  assert.equal(res.status, 403);
  const events = firestore.all("audit_logs").map((a) => (a as { event?: string }).event);
  assert.ok(events.includes("access_blocked_no_plus_plan"));
  cleanup();
});

test("10) con plus activo consume una vez y no reutiliza", async () => {
  const firestore = setup();
  firestore.seed("access_entitlements", "ent_plus_1", {
    id: "ent_plus_1",
    userId: users.owner.uid,
    userEmail: users.owner.email,
    leaseProcessId: null,
    planCode: "plus",
    accessType: "plus_paid",
    status: "active",
    maxContractsAllowed: 1,
    contractsUsed: 0,
  });
  const first = await consumePlusPOST(jsonPost("http://t/api/access/contracts/consume-plus", {}, tokens.owner));
  assert.equal(first.status, 200);
  const afterFirst = firestore.all("access_entitlements")[0] as { contractsUsed: number; status: string };
  assert.equal(afterFirst.contractsUsed, 1);
  assert.equal(afterFirst.status, "used");
  const second = await consumePlusPOST(jsonPost("http://t/api/access/contracts/consume-plus", {}, tokens.owner));
  assert.equal(second.status, 403);
  cleanup();
});

test("11) webhook firma inválida no activa acceso", async () => {
  const firestore = setup();
  process.env.WOMPI_EVENTS_SECRET = "sec_test";
  const order = makePlatformOrder({ id: "order_webhook_1", providerReference: "AS_PLUS_REF_SIG" });
  firestore.seed("platform_orders", order.id, order);
  const badEvent = {
    event: "transaction.updated",
    data: { transaction: { id: "tx_bad", status: "APPROVED", amount_in_cents: 3_990_000, currency: "COP", reference: "AS_PLUS_REF_SIG" } },
    signature: { properties: ["data.transaction.id"], checksum: "abcd" },
  };
  const res = await webhookPOST(jsonPost("http://t/api/platform-payments/webhook", badEvent));
  assert.equal(res.status, 401);
  assert.equal(firestore.all("access_entitlements").length, 0);
  const events = firestore.all("audit_logs").map((a) => (a as { event?: string }).event);
  assert.ok(events.includes("platform_payment_webhook_invalid_signature"));
  cleanup();
});

test("12) webhook monto incorrecto no activa acceso", async () => {
  const firestore = setup();
  process.env.WOMPI_EVENTS_SECRET = "sec_test";
  const order = makePlatformOrder({ id: "order_webhook_2", providerReference: "AS_PLUS_REF_AMT" });
  firestore.seed("platform_orders", order.id, order);
  const event = makeWompiEvent({
    reference: order.providerReference,
    status: "APPROVED",
    amountInCents: 1_000,
    currency: "COP",
    txId: "tx_amt",
    secret: "sec_test",
  });
  const res = await webhookPOST(jsonPost("http://t/api/platform-payments/webhook", event));
  assert.equal(res.status, 422);
  assert.equal(firestore.all("access_entitlements").length, 0);
  const events = firestore.all("audit_logs").map((a) => (a as { event?: string }).event);
  assert.ok(events.includes("platform_payment_webhook_amount_mismatch"));
  cleanup();
});

test("13) webhook moneda distinta no activa acceso", async () => {
  const firestore = setup();
  process.env.WOMPI_EVENTS_SECRET = "sec_test";
  const order = makePlatformOrder({ id: "order_webhook_3", providerReference: "AS_PLUS_REF_CUR" });
  firestore.seed("platform_orders", order.id, order);
  const event = makeWompiEvent({
    reference: order.providerReference,
    status: "APPROVED",
    amountInCents: 3_990_000,
    currency: "USD",
    txId: "tx_cur",
    secret: "sec_test",
  });
  const res = await webhookPOST(jsonPost("http://t/api/platform-payments/webhook", event));
  assert.equal(res.status, 422);
  assert.equal(firestore.all("access_entitlements").length, 0);
  const events = firestore.all("audit_logs").map((a) => (a as { event?: string }).event);
  assert.ok(events.includes("platform_payment_webhook_currency_mismatch"));
  cleanup();
});

test("14) webhook aprobado válido activa plus", async () => {
  const firestore = setup();
  process.env.WOMPI_EVENTS_SECRET = "sec_test";
  const order = makePlatformOrder({ id: "order_webhook_4", providerReference: "AS_PLUS_REF_OK", userId: users.owner.uid, userEmail: users.owner.email });
  firestore.seed("platform_orders", order.id, order);
  const event = makeWompiEvent({
    reference: order.providerReference,
    status: "APPROVED",
    amountInCents: 3_990_000,
    currency: "COP",
    txId: "tx_ok",
    secret: "sec_test",
  });
  const res = await webhookPOST(jsonPost("http://t/api/platform-payments/webhook", event));
  assert.equal(res.status, 200);
  const payments = firestore.all("platform_payments");
  const entitlements = firestore.all("access_entitlements");
  assert.equal(payments.length, 1);
  assert.equal(entitlements.length, 1);
  const updatedOrder = firestore.all("platform_orders")[0] as { status: string };
  assert.equal(updatedOrder.status, "approved");
  const events = firestore.all("audit_logs").map((a) => (a as { event?: string }).event);
  assert.ok(events.includes("platform_payment_approved"));
  assert.ok(events.includes("access_entitlement_created"));
  cleanup();
});

test("15) webhook duplicado no duplica payment ni entitlement", async () => {
  const firestore = setup();
  process.env.WOMPI_EVENTS_SECRET = "sec_test";
  const order = makePlatformOrder({ id: "order_webhook_5", providerReference: "AS_PLUS_REF_DUP", userId: users.owner.uid, userEmail: users.owner.email });
  firestore.seed("platform_orders", order.id, order);
  const event = makeWompiEvent({
    reference: order.providerReference,
    status: "APPROVED",
    amountInCents: 3_990_000,
    currency: "COP",
    txId: "tx_dup",
    secret: "sec_test",
  });
  const first = await webhookPOST(jsonPost("http://t/api/platform-payments/webhook", event));
  assert.equal(first.status, 200);
  const second = await webhookPOST(jsonPost("http://t/api/platform-payments/webhook", event));
  assert.equal(second.status, 200);
  const secondBody = (await second.json()) as { duplicated?: boolean };
  assert.equal(secondBody.duplicated, true);
  assert.equal(firestore.all("platform_payments").length, 1);
  assert.equal(firestore.all("access_entitlements").length, 1);
  const events = firestore.all("audit_logs").map((a) => (a as { event?: string }).event);
  assert.ok(events.includes("platform_payment_webhook_duplicate_ignored"));
  cleanup();
});

