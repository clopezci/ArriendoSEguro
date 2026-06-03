import { test } from "node:test";
import assert from "node:assert/strict";
import { directionForRaterRole, validateRatings, criteriaKeys } from "./criteria";

test("directionForRaterRole mapea rol a dirección", () => {
  assert.equal(directionForRaterRole("landlord"), "landlord_to_tenant");
  assert.equal(directionForRaterRole("tenant"), "tenant_to_landlord");
  assert.equal(directionForRaterRole("solidaryCoDebtor"), null);
});

test("validateRatings acepta exactamente las claves de la dirección (1-5)", () => {
  const keys = criteriaKeys("landlord_to_tenant");
  const ratings = Object.fromEntries(keys.map((k) => [k, 4]));
  const r = validateRatings("landlord_to_tenant", ratings);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.overall, 4);
});

test("validateRatings calcula el promedio (overall)", () => {
  const keys = criteriaKeys("tenant_to_landlord");
  const ratings: Record<string, number> = {};
  keys.forEach((k, i) => (ratings[k] = i === 0 ? 5 : 4)); // 5,4,4,4,4 => 4.2
  const r = validateRatings("tenant_to_landlord", ratings);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.overall, 4.2);
});

test("validateRatings rechaza valores fuera de 1-5 o no enteros", () => {
  const keys = criteriaKeys("landlord_to_tenant");
  const base = Object.fromEntries(keys.map((k) => [k, 3]));
  assert.equal(validateRatings("landlord_to_tenant", { ...base, [keys[0]]: 0 }).ok, false);
  assert.equal(validateRatings("landlord_to_tenant", { ...base, [keys[0]]: 6 }).ok, false);
  assert.equal(validateRatings("landlord_to_tenant", { ...base, [keys[0]]: 3.5 }).ok, false);
});

test("validateRatings rechaza claves faltantes o sobrantes", () => {
  const keys = criteriaKeys("landlord_to_tenant");
  const full = Object.fromEntries(keys.map((k) => [k, 3]));
  // Falta una clave.
  const missing = { ...full };
  delete missing[keys[0]];
  assert.equal(validateRatings("landlord_to_tenant", missing).ok, false);
  // Clave sobrante.
  assert.equal(validateRatings("landlord_to_tenant", { ...full, no_existe: 3 }).ok, false);
});
