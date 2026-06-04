import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveReferralConfig,
  defaultReferralConfig,
  normalizeReferralCode,
  isValidReferralCodeFormat,
  referralDiscountedCheckoutCop,
  canRegisterReferral,
  DEFAULT_REFERRAL_DISCOUNT_PERCENT,
} from "./referrals";

test("config por defecto: habilitado al 50%", () => {
  const c = defaultReferralConfig();
  assert.equal(c.enabled, true);
  assert.equal(c.discountPercent, DEFAULT_REFERRAL_DISCOUNT_PERCENT);
  assert.equal(DEFAULT_REFERRAL_DISCOUNT_PERCENT, 50);
});

test("resolveReferralConfig sin documento usa el default", () => {
  assert.deepEqual(resolveReferralConfig(undefined), defaultReferralConfig());
});

test("resolveReferralConfig respeta valores almacenados", () => {
  const c = resolveReferralConfig({ enabled: false, discountPercent: 30 });
  assert.equal(c.enabled, false);
  assert.equal(c.discountPercent, 30);
});

test("normaliza y valida el formato de código", () => {
  assert.equal(normalizeReferralCode(" ab-12cd "), "AB12CD");
  assert.equal(isValidReferralCodeFormat("ab12cd"), true);
  assert.equal(isValidReferralCodeFormat("short"), false); // < 6
  assert.equal(isValidReferralCodeFormat("toolongcode12"), false); // > 10
});

test("descuento aplica solo si habilitado y aprobado", () => {
  const cfg = defaultReferralConfig(); // 50%, enabled
  assert.deepEqual(referralDiscountedCheckoutCop(49900, cfg, "approved"), {
    finalCop: 24950,
    applied: true,
    discountPercent: 50,
  });
  assert.equal(referralDiscountedCheckoutCop(49900, cfg, "pending").applied, false);
  assert.equal(referralDiscountedCheckoutCop(49900, cfg, null).applied, false);
});

test("descuento no aplica si el programa está deshabilitado", () => {
  const cfg = resolveReferralConfig({ enabled: false, discountPercent: 50 });
  assert.equal(referralDiscountedCheckoutCop(49900, cfg, "approved").applied, false);
});

test("reglas de registro de referencia", () => {
  assert.equal(
    canRegisterReferral({ code: "ABC123", referrerUid: "u1", referredUid: "u2", alreadyReferred: false }).ok,
    true,
  );
  // auto-referencia
  assert.equal(
    canRegisterReferral({ code: "ABC123", referrerUid: "u1", referredUid: "u1", alreadyReferred: false }).ok,
    false,
  );
  // código inexistente
  assert.equal(
    canRegisterReferral({ code: "ABC123", referrerUid: null, referredUid: "u2", alreadyReferred: false }).ok,
    false,
  );
  // ya referido
  assert.equal(
    canRegisterReferral({ code: "ABC123", referrerUid: "u1", referredUid: "u2", alreadyReferred: true }).ok,
    false,
  );
  // formato inválido
  assert.equal(
    canRegisterReferral({ code: "xx", referrerUid: "u1", referredUid: "u2", alreadyReferred: false }).ok,
    false,
  );
});
