import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMaxUtilityGuaranteeCop, validateUtilityGuarantee } from "./utilityGuarantee";

test("computeMaxUtilityGuaranteeCop suma los dos períodos", () => {
  assert.equal(computeMaxUtilityGuaranteeCop(120000, 100000), 220000);
  assert.equal(computeMaxUtilityGuaranteeCop(0, 100000), 100000);
  assert.equal(computeMaxUtilityGuaranteeCop(-5, -5), 0);
});

test("validateUtilityGuarantee acepta valor dentro del máximo", () => {
  const r = validateUtilityGuarantee({ lastPeriod1Cop: 120000, lastPeriod2Cop: 100000, agreedAmountCop: 200000 });
  assert.equal(r.ok, true);
  assert.equal(r.maxAllowedCop, 220000);
});

test("validateUtilityGuarantee rechaza valor que supera el máximo (Art. 15)", () => {
  const r = validateUtilityGuarantee({ lastPeriod1Cop: 120000, lastPeriod2Cop: 100000, agreedAmountCop: 250000 });
  assert.equal(r.ok, false);
  assert.equal(r.maxAllowedCop, 220000);
});

test("validateUtilityGuarantee exige las dos facturas y el valor pactado", () => {
  assert.equal(validateUtilityGuarantee({ lastPeriod1Cop: 0, lastPeriod2Cop: 100000, agreedAmountCop: 50000 }).ok, false);
  assert.equal(validateUtilityGuarantee({ lastPeriod1Cop: 100000, lastPeriod2Cop: 100000, agreedAmountCop: 0 }).ok, false);
});
