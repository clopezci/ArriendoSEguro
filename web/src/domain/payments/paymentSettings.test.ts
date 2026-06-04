import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePaymentSettings, maskAccountNumber, describePaymentMethodForTenant } from "./paymentSettings";

test("method none no requiere consentimiento", () => {
  const r = validatePaymentSettings({ method: "none" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.method, "none");
});

test("cuenta exige consentimiento, entidad, tipo y número válido", () => {
  assert.equal(validatePaymentSettings({ method: "account", bank: "Bancolombia", accountType: "ahorros", accountNumber: "123456" }).ok, false); // sin consentimiento
  const ok = validatePaymentSettings({
    method: "account",
    bank: "Bancolombia",
    accountType: "ahorros",
    accountNumber: "1234567890",
    consentAccepted: true,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.accountNumber, "1234567890");
});

test("cuenta rechaza número no numérico", () => {
  const r = validatePaymentSettings({
    method: "account",
    bank: "Bancolombia",
    accountType: "corriente",
    accountNumber: "12ab",
    consentAccepted: true,
  });
  assert.equal(r.ok, false);
});

test("qr exige consentimiento y ruta gs://", () => {
  assert.equal(validatePaymentSettings({ method: "qr", qrStoragePath: "gs://b/x.png" }).ok, false); // sin consentimiento
  const ok = validatePaymentSettings({ method: "qr", qrStoragePath: "gs://b/contracts/c/payment-qr/1-x.png", consentAccepted: true });
  assert.equal(ok.ok, true);
});

test("maskAccountNumber deja últimos 4", () => {
  assert.equal(maskAccountNumber("1234567890"), "••••7890");
  assert.equal(maskAccountNumber("12"), "••••");
  assert.equal(maskAccountNumber(undefined), "");
});

test("describePaymentMethodForTenant es claro por método", () => {
  assert.match(describePaymentMethodForTenant({ method: "qr", consentAccepted: true }), /QR/);
  assert.match(
    describePaymentMethodForTenant({ method: "account", bank: "Bancolombia", accountType: "ahorros", accountNumber: "123", consentAccepted: true }),
    /Bancolombia/,
  );
  assert.match(describePaymentMethodForTenant({ method: "none", consentAccepted: false }), /no configuró/);
});
