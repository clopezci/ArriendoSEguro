import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Fija el env ANTES de importar el provider/config (appConfig.publicUrl se lee al cargar).
process.env.NEXT_PUBLIC_APP_URL = "https://arriendoseguro.app";
process.env.WOMPI_PUBLIC_KEY = "pub_test_abc123";
process.env.WOMPI_INTEGRITY_SECRET = "int_secret_xyz";
delete process.env.WOMPI_ENVIRONMENT;

type Provider = typeof import("@/domain/platform-payments/providers/wompi-payment-provider");
let providerPromise: Promise<Provider> | null = null;
function getProvider() {
  providerPromise ??= import("@/domain/platform-payments/providers/wompi-payment-provider");
  return providerPromise;
}

function baseOrder() {
  return {
    id: "order_1",
    userId: "u1",
    userEmail: "cliente@example.com",
    leaseProcessId: null,
    planCode: "plus" as const,
    amount: 20000, // COP enteros
    currency: "COP" as const,
    status: "created" as const,
    paymentProvider: "wompi" as const,
    providerReference: "AS_PLUS_REF_1",
    checkoutUrl: "",
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
  };
}

test("checkout usa el Web Checkout sandbox cuando la llave es de prueba", async () => {
  const { wompiPaymentProvider } = await getProvider();
  const { checkoutUrl } = await wompiPaymentProvider.createCheckout(baseOrder());
  const url = new URL(checkoutUrl);
  assert.equal(url.origin + url.pathname, "https://checkout.co.uat.wompi.dev/p/");
});

test("checkout incluye monto en centavos, referencia, email y redirect a Planes", async () => {
  const { wompiPaymentProvider } = await getProvider();
  const { checkoutUrl } = await wompiPaymentProvider.createCheckout(baseOrder());
  const p = new URL(checkoutUrl).searchParams;
  assert.equal(p.get("public-key"), "pub_test_abc123");
  assert.equal(p.get("currency"), "COP");
  assert.equal(p.get("amount-in-cents"), "2000000"); // 20000 * 100
  assert.equal(p.get("reference"), "AS_PLUS_REF_1");
  assert.equal(p.get("customer-data:email"), "cliente@example.com");
  assert.equal(
    p.get("redirect-url"),
    "https://arriendoseguro.app/dashboard/plans?order=AS_PLUS_REF_1",
  );
});

test("la firma de integridad es sha256(reference+amountInCents+currency+secret)", async () => {
  const { wompiPaymentProvider } = await getProvider();
  const { checkoutUrl } = await wompiPaymentProvider.createCheckout(baseOrder());
  const p = new URL(checkoutUrl).searchParams;
  const expected = createHash("sha256")
    .update("AS_PLUS_REF_1" + "2000000" + "COP" + "int_secret_xyz")
    .digest("hex");
  assert.equal(p.get("signature:integrity"), expected);
});

test("con WOMPI_ENVIRONMENT=production usa el Web Checkout real", async () => {
  const { wompiPaymentProvider } = await getProvider();
  process.env.WOMPI_ENVIRONMENT = "production";
  try {
    const { checkoutUrl } = await wompiPaymentProvider.createCheckout(baseOrder());
    const url = new URL(checkoutUrl);
    assert.equal(url.origin + url.pathname, "https://checkout.wompi.co/p/");
  } finally {
    delete process.env.WOMPI_ENVIRONMENT;
  }
});
