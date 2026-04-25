import type { PlatformOrder, WompiWebhookEvent } from "./types";

export interface PaymentProviderAdapter {
  createCheckout(order: PlatformOrder): Promise<{ checkoutUrl: string; providerReference: string }>;
  verifyWebhook(request: Request): Promise<boolean>;
  parseWebhookEvent(request: Request): Promise<WompiWebhookEvent>;
  getPaymentStatus(providerPaymentId: string): Promise<{ status: string; raw: string }>;
}

