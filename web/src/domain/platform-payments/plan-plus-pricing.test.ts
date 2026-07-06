import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePlanPlusPricingFromFirestoreData,
  getDefaultResolvedPlanPlusPricing,
  DEFAULT_PROMO_MESSAGE,
} from "./plan-plus-pricing";
import { CONTRACT_EARLY_BIRD_PRICE_COP, CONTRACT_LIST_PRICE_COP } from "@/lib/product-pricing";

test("sin documento usa la promoción de lanzamiento por defecto", () => {
  const r = resolvePlanPlusPricingFromFirestoreData(undefined);
  assert.deepEqual(r, getDefaultResolvedPlanPlusPricing());
  assert.equal(r.checkoutCop, CONTRACT_EARLY_BIRD_PRICE_COP);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.isPromo, true);
});

test("modo full cobra el precio pleno sin promoción", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({ mode: "full" });
  assert.equal(r.checkoutCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.isPromo, false);
  assert.equal(r.promoMessage, null);
});

test("promo por precio fijo con nombre y mensaje", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({
    mode: "promo",
    promoType: "fixed",
    promoFixedCop: 49900,
    promoName: "Lanzamiento",
    promoMessage: "Precio promocional por tiempo limitado",
  });
  assert.equal(r.checkoutCop, 49900);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.isPromo, true);
  assert.equal(r.promoName, "Lanzamiento");
  assert.equal(r.promoMessage, "Precio promocional por tiempo limitado");
});

test("promo por % de descuento sobre el precio pleno (redondeo a la centena)", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({
    mode: "promo",
    promoType: "percent",
    promoPercent: 50,
    listCop: 89900,
  });
  // 89900 * 0.5 = 44950 → redondeo a la centena = 45000
  assert.equal(r.checkoutCop, 45000);
  assert.equal(r.listCompareCop, 89900);
  assert.equal(r.isPromo, true);
  assert.equal(r.promoPercent, 50);
  assert.equal(r.promoMessage, DEFAULT_PROMO_MESSAGE); // usa el default si no se dio mensaje
});

test("promo con precio pleno personalizado", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({
    mode: "promo",
    promoType: "fixed",
    promoFixedCop: 59900,
    listCop: 120000,
  });
  assert.equal(r.checkoutCop, 59900);
  assert.equal(r.listCompareCop, 120000);
  assert.equal(r.isPromo, true);
});

test("promo que iguala o supera el precio pleno no inventa descuento", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({
    mode: "promo",
    promoType: "fixed",
    promoFixedCop: 100000,
    listCop: 89900,
  });
  assert.equal(r.checkoutCop, 89900); // capado al precio pleno
  assert.equal(r.isPromo, false);
});

// ---- Compatibilidad con el esquema anterior (presets) ----

test("legacy preset promo_49900 → promoción de lanzamiento", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({ preset: "promo_49900" });
  assert.equal(r.checkoutCop, CONTRACT_EARLY_BIRD_PRICE_COP);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.isPromo, true);
});

test("legacy preset list_89900 → precio pleno", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({ preset: "list_89900" });
  assert.equal(r.checkoutCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.isPromo, false);
});

test("legacy preset custom con monto propio", () => {
  const r = resolvePlanPlusPricingFromFirestoreData({ preset: "custom", customCheckoutCop: 39900 });
  assert.equal(r.checkoutCop, 39900);
  assert.equal(r.listCompareCop, CONTRACT_LIST_PRICE_COP);
  assert.equal(r.isPromo, true);
});
