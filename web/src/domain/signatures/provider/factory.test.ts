import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getSignatureProvider,
  resolveSignatureProviderId,
  getActiveSignatureProviderInfo,
  __resetSignatureProviderCacheForTests,
} from "./factory";
import { SignatureProviderNotConfiguredError } from "./types";
import { FirmaDevSignatureProvider } from "./firmaDevProvider";

afterEach(() => {
  delete process.env.SIGNATURE_PROVIDER;
  delete process.env.FIRMA_DEV_API_KEY;
  __resetSignatureProviderCacheForTests();
});

test("por defecto usa el proveedor interno", () => {
  __resetSignatureProviderCacheForTests();
  assert.equal(resolveSignatureProviderId(), "internal");
  const p = getSignatureProvider();
  assert.equal(p.id, "internal");
  assert.equal(p.isExternal, false);
  assert.equal(p.isConfigured(), true);
});

test("firma_dev sin credenciales cae al interno", () => {
  process.env.SIGNATURE_PROVIDER = "firma_dev";
  __resetSignatureProviderCacheForTests();
  assert.equal(resolveSignatureProviderId(), "firma_dev");
  const p = getSignatureProvider();
  assert.equal(p.id, "internal"); // fallback porque falta FIRMA_DEV_API_KEY
});

test("firma_dev con credenciales selecciona el adaptador externo", () => {
  process.env.SIGNATURE_PROVIDER = "firma_dev";
  process.env.FIRMA_DEV_API_KEY = "test-key";
  __resetSignatureProviderCacheForTests();
  const p = getSignatureProvider();
  assert.equal(p.id, "firma_dev");
  assert.equal(p.isExternal, true);
  assert.equal(p.isConfigured(), true);
});

test("el adaptador Firma.dev sin credenciales lanza NotConfigured", async () => {
  const provider = new FirmaDevSignatureProvider();
  assert.equal(provider.isConfigured(), false);
  await assert.rejects(
    () =>
      provider.createSignatureRequest({
        contractId: "c1",
        contractVersionId: "v1",
        documentHash: "h",
        signers: [{ party: "tenant", fullName: "X", email: "x@y.com", documentNumber: "1" }],
      }),
    SignatureProviderNotConfiguredError,
  );
});

test("getActiveSignatureProviderInfo no expone secretos", () => {
  __resetSignatureProviderCacheForTests();
  const info = getActiveSignatureProviderInfo();
  assert.deepEqual(Object.keys(info).sort(), ["configured", "id", "isExternal"]);
});
