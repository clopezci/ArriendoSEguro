import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateLegalMonthlyRentCap,
  getEffectiveCommercialValue,
  validateProposedRent,
  calculateMaxAllowedRentAfterIpc,
} from "./rent-law";

test("getEffectiveCommercialValue tope 2x avalúo", () => {
  const r = getEffectiveCommercialValue({ commercialValue: 500_000_000, cadastralValue: 100_000_000 });
  assert.equal(r.effective, 200_000_000);
  assert.equal(r.cappedByCadastre, true);
});

test("canon máximo 1% valor comercial efectivo", () => {
  const { cap, effectiveCommercial } = calculateLegalMonthlyRentCap({ commercialValue: 200_000_000 });
  assert.equal(effectiveCommercial, 200_000_000);
  assert.equal(cap, 2_000_000);
});

test("validateProposedRent bloquea exceso", () => {
  const v = validateProposedRent(3_000_000, { commercialValue: 200_000_000 });
  assert.equal(v.ok, false);
  assert.equal(v.cap, 2_000_000);
});

test("reajuste IPC 13%", () => {
  const { maxNewRent } = calculateMaxAllowedRentAfterIpc(2_000_000, 13);
  assert.equal(maxNewRent, 2_000_000 * 1.13);
});
