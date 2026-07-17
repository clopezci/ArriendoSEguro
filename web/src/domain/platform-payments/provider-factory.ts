import type { PaymentProviderAdapter } from "./provider-adapter";
import { mockPaymentProvider } from "./providers/mock-payment-provider";
import { wompiPaymentProvider } from "./providers/wompi-payment-provider";
import { brebPaymentProvider } from "./providers/breb-payment-provider";
import { isBrebEnabled } from "./breb-checkout";

export function isWompiConfigured(): boolean {
  return Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_PRIVATE_KEY);
}

export type PaymentProviderCode = "mock" | "wompi" | "breb";

export function getPaymentProvider(preferred?: PaymentProviderCode): {
  provider: PaymentProviderAdapter;
  providerCode: PaymentProviderCode;
} {
  if (preferred === "mock") return { provider: mockPaymentProvider, providerCode: "mock" };
  if (preferred === "breb" && isBrebEnabled()) return { provider: brebPaymentProvider, providerCode: "breb" };
  if (preferred === "wompi" && isWompiConfigured()) return { provider: wompiPaymentProvider, providerCode: "wompi" };
  if (process.env.NODE_ENV !== "production") return { provider: mockPaymentProvider, providerCode: "mock" };
  return isWompiConfigured()
    ? { provider: wompiPaymentProvider, providerCode: "wompi" }
    : { provider: mockPaymentProvider, providerCode: "mock" };
}
