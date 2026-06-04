import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRentCapCompliance,
  evaluateUtilityGuaranteeCompliance,
  evaluateDepositCompliance,
  evaluateLatePaymentCompliance,
  evaluateLegalCompliance,
  summarizeCompliance,
} from "./legalCompliance";

test("canon dentro del 1% → pass", () => {
  const c = evaluateRentCapCompliance({
    property: { commercialValue: 200_000_000 },
    lease: { monthlyRent: 1_500_000 },
  });
  assert.equal(c.status, "pass");
});

test("canon por encima del 1% → fail", () => {
  const c = evaluateRentCapCompliance({
    property: { commercialValue: 100_000_000 }, // tope = 1.000.000
    lease: { monthlyRent: 1_500_000 },
  });
  assert.equal(c.status, "fail");
});

test("valor comercial desconocido → info (responsabilidad declarada)", () => {
  const c = evaluateRentCapCompliance({
    property: { commercialValueUnknown: true },
    lease: { monthlyRent: 1_500_000 },
  });
  assert.equal(c.status, "info");
});

test("faltan datos del canon/valor → warn", () => {
  const c = evaluateRentCapCompliance({ property: {}, lease: {} });
  assert.equal(c.status, "warn");
});

test("garantía dentro del máximo y aceptada → pass", () => {
  const c = evaluateUtilityGuaranteeCompliance({
    utilityServicesGuarantee: { enabled: true, agreedAmountCop: 200_000, maxAllowedCop: 220_000, acceptedAt: "2026-06-04T00:00:00.000Z" },
  });
  assert.equal(c.status, "pass");
});

test("garantía que excede el máximo → fail", () => {
  const c = evaluateUtilityGuaranteeCompliance({
    utilityServicesGuarantee: { enabled: true, agreedAmountCop: 400_000, maxAllowedCop: 220_000 },
  });
  assert.equal(c.status, "fail");
});

test("garantía activada pero sin aceptar → warn", () => {
  const c = evaluateUtilityGuaranteeCompliance({
    utilityServicesGuarantee: { enabled: true, agreedAmountCop: 100_000, maxAllowedCop: 220_000 },
  });
  assert.equal(c.status, "warn");
});

test("garantía no incluida → info (es opcional)", () => {
  const c = evaluateUtilityGuaranteeCompliance({});
  assert.equal(c.status, "info");
});

test("depósito prohibido siempre cumple por diseño", () => {
  assert.equal(evaluateDepositCompliance().status, "pass");
});

test("mora >= 2 meses → pass; < 2 → warn", () => {
  assert.equal(evaluateLatePaymentCompliance({ lease: { latePaymentMonthsThreshold: 2 } }).status, "pass");
  assert.equal(evaluateLatePaymentCompliance({ lease: { latePaymentMonthsThreshold: 1 } }).status, "warn");
});

test("resumen: fail manda sobre warn; warn sobre pass; info no degrada", () => {
  const allGood = evaluateLegalCompliance({
    property: { commercialValue: 200_000_000 },
    lease: { monthlyRent: 1_000_000, latePaymentMonthsThreshold: 2 },
  });
  // Sin garantía (info) no degrada → overall pass.
  assert.equal(summarizeCompliance(allGood).overall, "pass");

  const withFail = evaluateLegalCompliance({
    property: { commercialValue: 100_000_000 },
    lease: { monthlyRent: 5_000_000, latePaymentMonthsThreshold: 2 },
  });
  assert.equal(summarizeCompliance(withFail).overall, "fail");

  const withWarn = evaluateLegalCompliance({
    property: {},
    lease: { latePaymentMonthsThreshold: 2 },
  });
  assert.equal(summarizeCompliance(withWarn).overall, "warn");
});
