import { randomUUID } from "node:crypto";
import type { PaymentProviderAdapter } from "../provider-adapter";
import type { PlatformOrder, WompiWebhookEvent } from "../types";

export const mockPaymentProvider: PaymentProviderAdapter = {
  async createCheckout(order: PlatformOrder) {
    const contractQ = order.leaseProcessId ? `&contract=${encodeURIComponent(order.leaseProcessId)}` : "";
    return {
      checkoutUrl: `/dashboard/plans?mockOrder=${encodeURIComponent(order.id)}${contractQ}`,
      providerReference: order.providerReference || `mock_${randomUUID()}`,
    };
  },
  async verifyWebhook() {
    return true;
  },
  async parseWebhookEvent(request: Request) {
    return (await request.json()) as WompiWebhookEvent;
  },
  async getPaymentStatus(providerPaymentId: string) {
    return { status: "APPROVED", raw: JSON.stringify({ providerPaymentId, source: "mock" }) };
  },
};

