import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyWompiWebhookSignature } from "@/domain/platform-payments/wompi-signature";

function buildEvent(secret: string) {
  const event = {
    event: "transaction.updated",
    data: {
      transaction: {
        id: "tx_123",
        status: "APPROVED",
        amount_in_cents: 3_990_000,
        currency: "COP",
        reference: "AS_PLUS_123",
      },
    },
    signature: {
      properties: [
        "data.transaction.id",
        "data.transaction.status",
        "data.transaction.amount_in_cents",
        "data.transaction.reference",
      ],
      checksum: "",
    },
  };
  const base =
    `${event.data.transaction.id}` +
    `${event.data.transaction.status}` +
    `${event.data.transaction.amount_in_cents}` +
    `${event.data.transaction.reference}`;
  const checksum = createHash("sha256").update(`${base}${secret}`).digest("hex");
  event.signature.checksum = checksum;
  return event;
}

test("verifyWompiWebhookSignature valida checksum correcto", () => {
  const secret = "events_secret_test";
  const event = buildEvent(secret);
  const r = verifyWompiWebhookSignature(event, new Headers(), { eventsSecret: secret });
  assert.equal(r.valid, true);
});

test("verifyWompiWebhookSignature falla con checksum alterado", () => {
  const secret = "events_secret_test";
  const event = buildEvent(secret);
  event.signature.checksum = "deadbeef";
  const r = verifyWompiWebhookSignature(event, new Headers(), { eventsSecret: secret });
  assert.equal(r.valid, false);
});

