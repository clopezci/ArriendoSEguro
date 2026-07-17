import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyOwnerResponse,
  reopenAfterRejection,
  validateMaintenanceInput,
  isInDispute,
  DISPUTE_REJECTION_THRESHOLD,
} from "./maintenance";

test("validateMaintenanceInput exige título, descripción y categoría válida", () => {
  assert.equal(validateMaintenanceInput({ title: "ab", description: "algo", category: "plumbing" }).ok, false);
  assert.equal(validateMaintenanceInput({ title: "Teja rota", description: "x", category: "plumbing" }).ok, false);
  assert.equal(validateMaintenanceInput({ title: "Teja rota", description: "Se filtra agua", category: "invalida" }).ok, false);
  const ok = validateMaintenanceInput({ title: "  Teja rota  ", description: "  Se filtra agua  ", category: "structural" });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.values.title, "Teja rota");
    assert.equal(ok.values.category, "structural");
  }
});

test("aceptar → estado accepted sin subir rechazos", () => {
  const r = applyOwnerResponse({ status: "open", rejectionCount: 0, responses: [] }, "accept", null, "t0");
  assert.equal(r.status, "accepted");
  assert.equal(r.rejectionCount, 0);
  assert.equal(r.responses.length, 1);
});

test("rechazos repetidos llevan a disputa al alcanzar el umbral", () => {
  let state = { status: "open" as const, rejectionCount: 0, responses: [] as ReturnType<typeof applyOwnerResponse>["responses"] };
  const r1 = applyOwnerResponse(state, "reject", "No es mi responsabilidad", "t1");
  assert.equal(r1.rejectionCount, 1);
  assert.equal(r1.status, DISPUTE_REJECTION_THRESHOLD <= 1 ? "in_dispute" : "rejected");
  // El inquilino insiste (reabrir) y el dueño vuelve a rechazar.
  const reopened = reopenAfterRejection({ status: r1.status, rejectionCount: r1.rejectionCount });
  assert.equal(reopened.status, "open");
  state = { status: reopened.status, rejectionCount: r1.rejectionCount, responses: r1.responses };
  const r2 = applyOwnerResponse(state, "reject", "Insisto que no", "t2");
  assert.equal(r2.rejectionCount, 2);
  assert.equal(r2.status, "in_dispute");
  assert.ok(isInDispute(r2.status));
  assert.equal(r2.responses.length, 2);
});

test("reabrir cuando está en disputa lo mantiene en disputa", () => {
  assert.equal(reopenAfterRejection({ status: "in_dispute", rejectionCount: 2 }).status, "in_dispute");
});
