import type { PaymentProviderAdapter } from "../provider-adapter";
import type { PlatformOrder, WompiWebhookEvent } from "../types";
import { verifyWompiWebhookSignature } from "../wompi-signature";
import { buildWompiCheckoutUrl, wompiApiBaseUrl } from "../wompi-checkout";
import { appConfig } from "@/lib/config";

export const wompiPaymentProvider: PaymentProviderAdapter = {
  async createCheckout(order: PlatformOrder) {
    // Al terminar (o cancelar) el pago, Wompi devuelve al usuario a la página de
    // Planes con la referencia, para que la app consulte el estado de la orden.
    const base = appConfig.publicUrl.replace(/\/$/, "");
    // Llevamos también el contrato para que, al confirmarse el pago, la app pueda
    // devolver al usuario AL PASO donde iba (vista previa/firma) y continuar.
    const contractQ = order.leaseProcessId ? `&contract=${encodeURIComponent(order.leaseProcessId)}` : "";
    const redirectUrl = `${base}/dashboard/plans?order=${encodeURIComponent(order.providerReference)}${contractQ}`;

    const checkoutUrl = buildWompiCheckoutUrl({
      reference: order.providerReference,
      amountInCents: Math.round(order.amount * 100),
      currency: order.currency,
      redirectUrl,
      customerEmail: order.userEmail || undefined,
    });
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
