import type { PaymentProviderAdapter } from "../provider-adapter";
import type { PlatformOrder, WompiWebhookEvent } from "../types";
import { buildWompiIntegritySignature, verifyWompiWebhookSignature } from "../wompi-signature";
import { appConfig } from "@/lib/config";

/**
 * Entorno de Wompi. Se resuelve por `WOMPI_ENVIRONMENT` y, si no está, se infiere
 * del prefijo de la llave pública (`pub_test_` = sandbox). Así, con solo poner
 * llaves de prueba, todo el flujo apunta al sandbox (feature flag natural).
 */
function isSandbox(): boolean {
  const env = (process.env.WOMPI_ENVIRONMENT ?? "").trim().toLowerCase();
  if (env === "production" || env === "prod") return false;
  if (env === "sandbox" || env === "test") return true;
  return (process.env.WOMPI_PUBLIC_KEY ?? "").startsWith("pub_test_");
}

/** API REST de Wompi (consultar transacciones). */
function wompiApiBaseUrl(): string {
  return isSandbox() ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
}

/** Web Checkout de Wompi (redirección del usuario para pagar). */
function wompiCheckoutHost(): string {
  return isSandbox() ? "https://checkout.co.uat.wompi.dev/p/" : "https://checkout.wompi.co/p/";
}

export const wompiPaymentProvider: PaymentProviderAdapter = {
  async createCheckout(order: PlatformOrder) {
    const publicKey = process.env.WOMPI_PUBLIC_KEY ?? "";
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET ?? "";
    const amountInCents = Math.round(order.amount * 100);
    const currency = order.currency;

    const integrity = buildWompiIntegritySignature({
      reference: order.providerReference,
      amountInCents,
      currency,
      integritySecret,
    });

    // Al terminar (o cancelar) el pago, Wompi devuelve al usuario a la página de
    // Planes con la referencia, para que la app consulte el estado de la orden.
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const redirectUrl = `${base}/dashboard/plans?order=${encodeURIComponent(order.providerReference)}`;

    // Web Checkout por URL (sin backend adicional): el usuario paga en Wompi y
    // el webhook confirma la transacción y otorga el acceso Plus.
    const params = new URLSearchParams();
    params.set("public-key", publicKey);
    params.set("currency", currency);
    params.set("amount-in-cents", String(amountInCents));
    params.set("reference", order.providerReference);
    params.set("signature:integrity", integrity);
    params.set("redirect-url", redirectUrl);
    if (order.userEmail) params.set("customer-data:email", order.userEmail);

    const checkoutUrl = `${wompiCheckoutHost()}?${params.toString()}`;
    return { checkoutUrl, providerReference: order.providerReference };
  },

  async verifyWebhook(request: Request) {
    // Firma real del evento (sha256 de las propiedades indicadas + timestamp + secreto).
    // Nota: la ruta del webhook ya valida con `verifyWompiWebhookSignature`; este
    // método queda consistente por si se usa el adaptador de forma independiente.
    try {
      const body = await request.json();
      return verifyWompiWebhookSignature(body, request.headers).valid;
    } catch {
      return false;
    }
  },

  async parseWebhookEvent(request: Request) {
    return (await request.json()) as WompiWebhookEvent;
  },

  async getPaymentStatus(providerPaymentId: string) {
    const privateKey = process.env.WOMPI_PRIVATE_KEY ?? "";
    const res = await fetch(`${wompiApiBaseUrl()}/transactions/${encodeURIComponent(providerPaymentId)}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
      cache: "no-store",
    });
    const raw = await res.text();
    if (!res.ok) return { status: "ERROR", raw };
    let parsed: { data?: { status?: string } } = {};
    try {
      parsed = JSON.parse(raw) as { data?: { status?: string } };
    } catch {
      // ignore parse error
    }
    return { status: parsed.data?.status ?? "UNKNOWN", raw };
  },
};
