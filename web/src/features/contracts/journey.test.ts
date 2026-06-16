import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveJourneyState, CONTRACT_PHASES, isSignedStatus } from "./journey";

test("sin versión guardada: solo 'datos' activa, resto bloqueado", () => {
  const s = deriveJourneyState(null);
  assert.equal(s.datos, "active");
  assert.equal(s.firmar, "locked");
  assert.equal(s.pdf, "locked");
  assert.equal(s.posventa, "locked");
});

test("con versión guardada (no firmado): datos hecha, firmar activa, posventa bloqueada", () => {
  const s = deriveJourneyState({ currentVersionId: "v1", contractStatus: "draft" });
  assert.equal(s.datos, "done");
  assert.equal(s.firmar, "active");
  assert.equal(s.pdf, "todo");
  assert.equal(s.posventa, "locked");
});

test("firma en curso: firmar activa", () => {
  const s = deriveJourneyState({ currentVersionId: "v1", contractStatus: "signature_in_progress" });
  assert.equal(s.firmar, "active");
});

test("firmado: firmar hecha, posventa disponible", () => {
  const s = deriveJourneyState({ currentVersionId: "v1", contractStatus: "signed" });
  assert.equal(s.firmar, "done");
  assert.equal(s.posventa, "todo");
});

test("hay 4 fases en orden", () => {
  assert.deepEqual(
    CONTRACT_PHASES.map((p) => p.key),
    ["datos", "firmar", "pdf", "posventa"],
  );
});

test("isSignedStatus solo true para 'signed'", () => {
  assert.equal(isSignedStatus("signed"), true);
  assert.equal(isSignedStatus("draft"), false);
  assert.equal(isSignedStatus(null), false);
});
