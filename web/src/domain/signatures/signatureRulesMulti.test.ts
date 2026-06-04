import { test } from "node:test";
import assert from "node:assert/strict";
import { requiredParties, codebtorPartyType, allRequiredSignaturesCompleted } from "./signatureRules";
import type { SignatureRecord } from "./types";

test("requiredParties acepta booleano (compat)", () => {
  assert.deepEqual(requiredParties(false), ["landlord", "tenant"]);
  assert.deepEqual(requiredParties(true), ["landlord", "tenant", "solidaryCoDebtor"]);
});

test("requiredParties acepta cantidad de codeudores", () => {
  assert.deepEqual(requiredParties(0), ["landlord", "tenant"]);
  assert.deepEqual(requiredParties(2), ["landlord", "tenant", "solidaryCoDebtor", "solidaryCoDebtor_2"]);
  assert.deepEqual(requiredParties(3), [
    "landlord",
    "tenant",
    "solidaryCoDebtor",
    "solidaryCoDebtor_2",
    "solidaryCoDebtor_3",
  ]);
});

test("codebtorPartyType usa sufijos correctos", () => {
  assert.equal(codebtorPartyType(0), "solidaryCoDebtor");
  assert.equal(codebtorPartyType(1), "solidaryCoDebtor_2");
});

test("allRequiredSignaturesCompleted exige a TODOS los codeudores", () => {
  const sig = (partyType: string): SignatureRecord =>
    ({ partyType, signatureStatus: "signed" } as unknown as SignatureRecord);
  const two = [sig("landlord"), sig("tenant"), sig("solidaryCoDebtor")];
  assert.equal(allRequiredSignaturesCompleted(two, 2), false); // falta solidaryCoDebtor_2
  const complete = [...two, sig("solidaryCoDebtor_2")];
  assert.equal(allRequiredSignaturesCompleted(complete, 2), true);
});
