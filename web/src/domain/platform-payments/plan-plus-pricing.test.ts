import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePlanPlusPricingFromFirestoreData,
  getDefaultResolvedPlanPlusPricing,
} from "./plan-plus-pricing";
import { CONTRACT_EARLY_BIRD_PRICE_COP, CONTRACT_LIST_PRICE_COP } from "@/lib/product-pricing";

test("sin documento usa la promoción por defecto", () => {
  const r = resolvePlanPlusPricingFromFirestoreData(undefined);
  assert.deepEqual(r, getDefaultResolvedPlanPlusPricing());
});

test("preset promo_49900 devuelve early bird con lista tachada por defecto", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({ preset: "promo_49900" });
  assert.equal(r.checkoutCop, CONTRACT_EARLY_BIRD_PRICE_COP);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.preset, "promo_49900");
});

test("preset list_89900 iguala checkout y lista", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({ preset: "list_89900" });
  assert.equal(r.checkoutCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
});

test("custom sin lista personalizada cae al precio de lista por defecto", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({ preset: "custom", customCheckoutCop: 39900 });
  assert.equal(r.checkoutCop, 39900);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.preset, "custom");
});

test("custom con lista personalizada válida (>= checkout) la respeta", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({
    preset: "custom",
    customCheckoutCop: 59900,
    customListCop: 120000,
  });
  assert.equal(r.checkoutCop, 59900);
  assert.equal(r.listCompareCop, 120000);
});

test("custom con lista personalizada menor al checkout la ignora", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({
    preset: "custom",
    customCheckoutCop: 59900,
    customListCop: 40000,
  });
  assert.equal(r.checkoutCop, 59900);
  // checkout >= lista por defecto => fallback = checkout (no se muestra tachado falso)
  assert.equal(r.listCompareCop, 59900 < CONTRACT_LIST_PRICE_COP ? CONTRACT_LIST_PRICE_COP : 59900);
});

test("custom con checkout mayor a la lista por defecto y sin lista propia no inventa descuento", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({ preset: "custom", customCheckoutCop: 150000 });
  assert.equal(r.checkoutCop, 150000);
  assert.equal(r.listCompareCop, 150000);
});
