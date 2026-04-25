import test from "node:test";
import assert from "node:assert/strict";
import { canCreateRealContract } from "@/domain/platform-payments/access-rules";

test("usuario con solo demo no puede crear contrato real", () => {
  const r = canCreateRealContract({ plusActive: false, demoActive: true });
  assert.equal(r.allowed, false);
  assert.equal(r.reason, "no_plus_plan");
});

test("usuario con plus activo puede crear contrato real", () => {
  const r = canCreateRealContract({ plusActive: true, demoActive: false });
  assert.equal(r.allowed, true);
});

