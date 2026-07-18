import { test } from "node:test";
import assert from "node:assert/strict";
import { getDocValidationSpec } from "./docValidationSpec";

test("colilla_2 y extracto_3 caen en su familia", () => {
  assert.equal(getDocValidationSpec("colilla_2")?.label, "Colilla de pago");
  assert.equal(getDocValidationSpec("extracto_3")?.label, "Extracto bancario");
});

test("cédula compara nombre y número; extracto solo nombre", () => {
  const ced = getDocValidationSpec("cedula");
  assert.equal(ced?.comparesName, true);
  assert.equal(ced?.comparesDocNumber, true);
  const ext = getDocValidationSpec("extracto_1");
  assert.equal(ext?.comparesName, true);
  assert.equal(ext?.comparesDocNumber, false);
  assert.equal(ext?.checksKind, true);
});

test("declaracion_renta_codeudor mapea a declaracion_renta; otro_* no se valida", () => {
  assert.equal(getDocValidationSpec("declaracion_renta_codeudor")?.label, "Declaración de renta");
  assert.equal(getDocValidationSpec("otro_1"), null);
  assert.equal(getDocValidationSpec("otro_2"), null);
});
