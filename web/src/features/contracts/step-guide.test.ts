import { test } from "node:test";
import assert from "node:assert/strict";
import { stepGuide, WIZARD_STEP_COUNT } from "./step-guide";

test("hay 10 pasos guiados", () => {
  assert.equal(WIZARD_STEP_COUNT, 10);
});

test("stepGuide devuelve título, ayuda y siguiente con índice/total", () => {
  const g = stepGuide(2);
  assert.ok(g);
  assert.equal(g!.index, 2);
  assert.equal(g!.total, 10);
  assert.match(g!.title, /Arrendador/);
  assert.ok(g!.hint.length > 0);
  assert.ok(g!.next.length > 0);
});

test("el último paso apunta a la posventa", () => {
  const g = stepGuide(10);
  assert.ok(g);
  assert.match(g!.next, /Posventa/i);
});

test("fuera de rango devuelve null", () => {
  assert.equal(stepGuide(0), null);
  assert.equal(stepGuide(11), null);
  assert.equal(stepGuide(NaN), null);
});
