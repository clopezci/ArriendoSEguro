import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveLeadOutcome,
  parseContactEmails,
  validatePartnerInput,
  seedTestPartners,
  isPartnerCategory,
} from "./partners";

test("doble confirmación: ambos 'tomado' → convertido y elegible", () => {
  const o = deriveLeadOutcome("taken", "taken");
  assert.equal(o.code, "converted");
  assert.equal(o.commissionEligible, true);
  assert.equal(o.needsReview, false);
});

test("ambos 'no tomado' → no convertido, no elegible", () => {
  const o = deriveLeadOutcome("not_taken", "not_taken");
  assert.equal(o.code, "not_converted");
  assert.equal(o.commissionEligible, false);
});

test("anti-fraude: aliado dice 'no' pero usuario dice 'sí' → disputa, elegible por evidencia del usuario", () => {
  const o = deriveLeadOutcome("not_taken", "taken");
  assert.equal(o.code, "disputed");
  assert.equal(o.needsReview, true);
  assert.equal(o.commissionEligible, true);
});

test("usuario confirma y falta el aliado → a la espera del aliado, ya elegible", () => {
  const o = deriveLeadOutcome(null, "taken");
  assert.equal(o.code, "awaiting_partner");
  assert.equal(o.commissionEligible, true);
});

test("sin respuestas → pendiente", () => {
  assert.equal(deriveLeadOutcome(null, null).code, "pending");
});

test("parseContactEmails separa, valida y deduplica", () => {
  assert.deepEqual(parseContactEmails("a@x.com, b@y.com; a@x.com\nmal"), ["a@x.com", "b@y.com"]);
});

test("validatePartnerInput exige nombre, categoría y al menos un correo", () => {
  assert.equal(validatePartnerInput({ name: "X" }).ok, false); // categoría/correo faltan
  const ok = validatePartnerInput({
    name: "Aliado",
    category: "recaudo",
    contactEmails: "a@x.com",
    active: true,
    websiteUrl: "https://x.com",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.value.contactEmails, ["a@x.com"]);
});

test("validatePartnerInput rechaza enlace sin http", () => {
  const r = validatePartnerInput({ name: "Aliado", category: "seguro", contactEmails: "a@x.com", websiteUrl: "x.com" });
  assert.equal(r.ok, false);
});

test("isPartnerCategory valida el enum", () => {
  assert.equal(isPartnerCategory("recaudo"), true);
  assert.equal(isPartnerCategory("nope"), false);
});

test("seedTestPartners usa el correo de respaldo y cubre seguro, cobranza, jurídica y estudio de crédito", () => {
  const seed = seedTestPartners("fundador@x.com");
  assert.equal(seed.length, 4);
  assert.ok(seed.every((p) => p.active));
  assert.ok(seed.every((p) => p.contactEmails.includes("fundador@x.com")));
  const cats = seed.map((p) => p.category).sort();
  assert.deepEqual(cats, ["cobranza", "estudio_credito", "juridica", "seguro"]);
});
