import { test } from "node:test";
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import { createMockFirestore } from "../platform-payments/mockFirestore";
import { signHubBody, verifyHubSignature } from "@/domain/hub/hub-signature";
import { processHubWompiEvent, mapWompiStatusToOrderStatus } from "@/domain/hub/hub-webhook";

const NOW = 1_770_000_000_000; // timestamp fijo (Date.now no disponible en algunos entornos de test)

test("firma HMAC: válida, mismatch y timestamp viejo", () => {
  const secret = "hubs_test";
  const body = JSON.stringify({ amountInCents: 1000 });
  const ts = String(NOW);
  const sig = signHubBody(secret, ts, body);

  assert.equal(verifyHubSignature({ secret, timestamp: ts, rawBody: body, signature: sig, nowMs: NOW }).valid, true);
  assert.equal(
    verifyHubSignature({ secret, timestamp: ts, rawBody: body, signature: "deadbeef", nowMs: NOW }).valid,
    false,
  );
  // Timestamp fuera de la ventana de 5 min.
  assert.equal(
    verifyHubSignature({ secret, timestamp: ts, rawBody: body, signature: sig, nowMs: NOW + 6 * 60 * 1000 }).valid,
    false,
  );
});

test("mapeo de estado Wompi → orden", () => {
  assert.equal(mapWompiStatusToOrderStatus("APPROVED"), "approved");
  assert.equal(mapWompiStatusToOrderStatus("DECLINED"), "rejected");
  assert.equal(mapWompiStatusToOrderStatus("VOIDED"), "rejected");
  assert.equal(mapWompiStatusToOrderStatus("PENDING"), "pending");
  assert.equal(mapWompiStatusToOrderStatus(undefined), "pending");
});

function seedOrder(fs: ReturnType<typeof createMockFirestore>) {
  fs.seed("hub_apps", "app1", { id: "app1", name: "Test", webhookUrl: "", hmacSecret: "s", active: true });
  fs.seed("hub_orders", "ord1", {
    id: "ord1",
    appId: "app1",
    amountInCents: 500000,
    currency: "COP",
    externalReference: "EXT-1",
    providerReference: "HUB_ord1",
    status: "pending",
    metadata: null,
  });
}

function event(status: string, amountInCents: number, txId = "tx1") {
  return {
    event: "transaction.updated",
    data: {
      transaction: { id: txId, status, amount_in_cents: amountInCents, currency: "COP", reference: "HUB_ord1" },
    },
  };
}

test("webhook hub aprobado: marca approved y registra pago", async () => {
  const fs = createMockFirestore();
  seedOrder(fs);
  const r = await processHubWompiEvent(fs as unknown as Firestore, event("APPROVED", 500000), NOW);
  assert.equal(r.httpStatus, 200);
  assert.equal(r.body.status, "approved");
  assert.equal(fs.all("hub_payments").length, 1);
  assert.equal((fs.all("hub_orders")[0] as { status?: string }).status, "approved");
});

test("webhook hub con monto distinto: 422", async () => {
  const fs = createMockFirestore();
  seedOrder(fs);
  const r = await processHubWompiEvent(fs as unknown as Firestore, event("APPROVED", 999999), NOW);
  assert.equal(r.httpStatus, 422);
  assert.equal(r.body.error, "amount_mismatch");
  assert.equal(fs.all("hub_payments").length, 0);
});

test("webhook hub duplicado: no registra dos veces", async () => {
  const fs = createMockFirestore();
  seedOrder(fs);
  await processHubWompiEvent(fs as unknown as Firestore, event("APPROVED", 500000, "txDup"), NOW);
  const r2 = await processHubWompiEvent(fs as unknown as Firestore, event("APPROVED", 500000, "txDup"), NOW);
  assert.equal(r2.body.duplicated, true);
  assert.equal(fs.all("hub_payments").length, 1);
});

test("webhook hub sin orden: 404", async () => {
  const fs = createMockFirestore();
  const r = await processHubWompiEvent(fs as unknown as Firestore, event("APPROVED", 500000), NOW);
  assert.equal(r.httpStatus, 404);
});
