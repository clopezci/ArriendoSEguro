import { createHash } from "node:crypto";
import type { PaymentProviderAdapter } from "../provider-adapter";
import type { PlatformOrder, WompiWebhookEvent } from "../types";

function wompiBaseUrl(): string {
  return process.env.WOMPI_ENVIRONMENT === "production"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

export const wompiPaymentProvider: PaymentProviderAdapter = {
  async createCheckout(order: PlatformOrder) {
    const publicKey = process.env.WOMPI_PUBLIC_KEY ?? "";
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET ?? "";
    const amountInCents = order.amount * 100;
    const integrity = createHash("sha256")
      .update(`${order.providerReference}${amountInCents}${order.currency}${integritySecret}`)
      .digest("hex");
    // TODO: si se requiere firma/params adicionales de Wompi, ajustarlo aquí con la documentación oficial.
    const checkoutUrl = `${wompiBaseUrl().replace("/v1", "")}/checkout?public-key=${encodeURIComponent(
      publicKey,
    )}&currency=${order.currency}&amount-in-cents=${amountInCents}&reference=${encodeURIComponent(
      order.providerReference,
    )}&signature:integrity=${integrity}`;
    return { checkoutUrl, providerReference: order.providerReference };
  },

  async verifyWebhook(request: Request) {
    const secret = process.env.WOMPI_EVENTS_SECRET ?? "";
    if (!secret) return false;
    const signature = request.headers.get("x-wompi-signature") ?? "";
    if (!signature) return false;
    // TODO: implementar algoritmo exacto exigido por Wompi para verificación de firma.
    return signature.length > 10;
  },

  async parseWebhookEvent(request: Request) {
    return (await request.json()) as WompiWebhookEvent;
  },

  async getPaymentStatus(providerPaymentId: string) {
    const privateKey = process.env.WOMPI_PRIVATE_KEY ?? "";
    const res = await fetch(`${wompiBaseUrl()}/transactions/${encodeURIComponent(providerPaymentId)}`, {
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

