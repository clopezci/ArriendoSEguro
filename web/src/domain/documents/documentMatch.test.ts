import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nameMatches,
  documentNumberMatches,
  addressMatches,
  combineVerdicts,
} from "./documentMatch";

test("nameMatches: tolera tildes, orden y nombre parcial", () => {
  assert.equal(nameMatches("María José Gómez", ["GOMEZ MARIA JOSE"]), "match");
  assert.equal(nameMatches("Juan Pérez", ["Juan Carlos Pérez Ríos"]), "match");
  assert.equal(nameMatches("Juan Pérez", ["Pedro Martínez"]), "mismatch");
  assert.equal(nameMatches("Juan Pérez", []), "unclear");
});

test("documentNumberMatches: ignora puntos/espacios", () => {
  assert.equal(documentNumberMatches("1.020.304.050", "1020304050"), "match");
  assert.equal(documentNumberMatches("1020304050", "1020304999"), "mismatch");
  assert.equal(documentNumberMatches("", "1020"), "unclear");
});

test("addressMatches: tolera abreviaturas pero exige números", () => {
  assert.equal(addressMatches("Carrera 45 # 12-30", "Cra 45 No 12 30 apto 501"), "match");
  assert.equal(addressMatches("Calle 10 # 5-20", "Carrera 80 # 100-15"), "mismatch");
  // Misma vía pero números distintos → no coincide.
  assert.equal(addressMatches("Calle 10 # 5-20", "Calle 10 # 7-40"), "mismatch");
});

test("combineVerdicts: cualquier mismatch manda", () => {
  assert.equal(combineVerdicts(["match", "match"]), "match");
  assert.equal(combineVerdicts(["match", "mismatch"]), "mismatch");
  assert.equal(combineVerdicts(["match", "unclear"]), "unclear");
});
