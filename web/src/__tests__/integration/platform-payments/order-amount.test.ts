import { test } from "node:test";
import assert from "node:assert/strict";
import type { Firestore } from "firebase-admin/firestore";
import { createMockFirestore } from "./mockFirestore";
import { computePlanPlusOrderAmount } from "@/domain/platform-payments/order-amount";

// Precio Plan Plus por defecto (sin doc de pricing) = $49.900.
// Precio cláusula «Otra» por defecto (sin legal config) = $50.000.

function seedContractWithClause(fs: ReturnType<typeof createMockFirestore>, selected: string[]) {
  fs.seed("contracts", "lease1", { currentVersionId: "v1" });
  fs.seed("contract_versions", "v1", {
    contractPayload: { specialClauses: { enabled: true, selected } },
  });
}

test("sin expediente: solo Plan Plus", async () => {
  const fs = createMockFirestore();
  const r = await computePlanPlusOrderAmount(fs as unknown as Firestore, { leaseProcessId: null });
  assert.equal(r.planPlusCop, 49900);
  assert.equal(r.clauseCop, 0);
  assert.equal(r.totalCop, 49900);
  assert.equal(r.hasCostedClause, false);
  assert.equal(r.lineItems.length, 1);
});

test("expediente con cláusula «Otra»: suma $50.000 al total", async () => {
  const fs = createMockFirestore();
  seedContractWithClause(fs, ["MASCOTAS", "OTRA"]);
  const r = await computePlanPlusOrderAmount(fs as unknown as Firestore, { leaseProcessId: "lease1" });
  assert.equal(r.planPlusCop, 49900);
  assert.equal(r.clauseCop, 50000);
  assert.equal(r.totalCop, 99900);
  assert.equal(r.hasCostedClause, true);
  assert.equal(r.lineItems.length, 2);
  assert.equal(r.lineItems[1].code, "special_clause_other");
});

test("expediente sin cláusula «Otra»: no suma", async () => {
  const fs = createMockFirestore();
  seedContractWithClause(fs, ["MASCOTAS", "PARQUEADERO"]);
  const r = await computePlanPlusOrderAmount(fs as unknown as Firestore, { leaseProcessId: "lease1" });
  assert.equal(r.totalCop, 49900);
  assert.equal(r.hasCostedClause, false);
  assert.equal(r.lineItems.length, 1);
});

test("expediente inexistente: no rompe, solo Plan Plus", async () => {
  const fs = createMockFirestore();
  const r = await computePlanPlusOrderAmount(fs as unknown as Firestore, { leaseProcessId: "noexiste" });
  assert.equal(r.totalCop, 49900);
  assert.equal(r.hasCostedClause, false);
});

test("borrador con «Otra» + revisión CANCELADA vieja → SÍ cobra (el borrador manda)", async () => {
  // Caso del re-test: el usuario había 'Quitado' antes (revisión cancelada) y
  // ahora re-agrega la cláusula (borrador con OTRA). Debe cobrar.
  const fs = createMockFirestore();
  fs.seed("contract_drafts", "lease1", { payload: { specialClauses: { enabled: true, selected: ["OTRA"] } } });
  fs.seed("special_clause_reviews", "rev1", { contractDraftId: "lease1", status: "cancelled" });
  const r = await computePlanPlusOrderAmount(fs as unknown as Firestore, { leaseProcessId: "lease1" });
  assert.equal(r.hasCostedClause, true);
  assert.equal(r.totalCop, 99900);
});

test("tras 'Quitar' (borrador y versión SIN «Otra» + revisión cancelada) → NO cobra", async () => {
  const fs = createMockFirestore();
  fs.seed("contract_drafts", "lease1", { payload: { specialClauses: { enabled: false, selected: [] } } });
  fs.seed("contracts", "lease1", { currentVersionId: "v1" });
  fs.seed("contract_versions", "v1", { contractPayload: { specialClauses: { enabled: false, selected: [] } } });
  fs.seed("special_clause_reviews", "rev1", { contractDraftId: "lease1", status: "cancelled" });
  const r = await computePlanPlusOrderAmount(fs as unknown as Firestore, { leaseProcessId: "lease1" });
  assert.equal(r.hasCostedClause, false);
  assert.equal(r.totalCop, 49900);
});

test("revisión PENDIENTE (respaldo) sin borrador con «Otra» → cobra", async () => {
  const fs = createMockFirestore();
  fs.seed("contracts", "lease1", { currentVersionId: "v1" });
  fs.seed("contract_versions", "v1", { contractPayload: { specialClauses: { enabled: false, selected: [] } } });
  fs.seed("special_clause_reviews", "rev1", { contractDraftId: "lease1", status: "pending" });
  const r = await computePlanPlusOrderAmount(fs as unknown as Firestore, { leaseProcessId: "lease1" });
  assert.equal(r.hasCostedClause, true);
  assert.equal(r.totalCop, 99900);
});
