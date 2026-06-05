import { test } from "node:test";
import assert from "node:assert/strict";
import { isTokenUsable, tokenStateLabel } from "./paymentUploadToken";

const now = Date.parse("2026-06-04T00:00:00.000Z");

test("token activo y no vencido es usable", () => {
  assert.equal(isTokenUsable({ status: "active", expiresAt: "2026-07-01T00:00:00.000Z" }, now), true);
});

test("token vencido no es usable", () => {
  assert.equal(isTokenUsable({ status: "active", expiresAt: "2026-05-01T00:00:00.000Z" }, now), false);
});

test("token usado no es usable", () => {
  assert.equal(isTokenUsable({ status: "used", expiresAt: "2026-07-01T00:00:00.000Z" }, now), false);
});

test("token inexistente no es usable", () => {
  assert.equal(isTokenUsable(null, now), false);
});

test("tokenStateLabel refleja el estado", () => {
  assert.equal(tokenStateLabel({ status: "active", expiresAt: "2026-07-01T00:00:00.000Z" }, now), "usable");
  assert.equal(tokenStateLabel({ status: "used", expiresAt: "2026-07-01T00:00:00.000Z" }, now), "used");
  assert.equal(tokenStateLabel({ status: "active", expiresAt: "2026-05-01T00:00:00.000Z" }, now), "expired");
  assert.equal(tokenStateLabel(null, now), "expired");
});
