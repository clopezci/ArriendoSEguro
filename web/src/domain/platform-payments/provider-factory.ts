import type { PaymentProviderAdapter } from "./provider-adapter";
import { mockPaymentProvider } from "./providers/mock-payment-provider";
import { wompiPaymentProvider } from "./providers/wompi-payment-provider";

export function isWompiConfigured(): boolean {
  return Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_PRIVATE_KEY);
}

export function getPaymentProvider(preferred?: "mock" | "wompi"): {
  provider: PaymentProviderAdapter;
  providerCode: "mock" | "wompi";
} {
  if (preferred === "mock") return { provider: mockPaymentProvider, providerCode: "mock" };
  if (preferred === "wompi" && isWompiConfigured()) return { provider: wompiPaymentProvider, providerCode: "wompi" };
  if (process.env.NODE_ENV !== "production") return { provider: mockPaymentProvider, providerCode: "mock" };
  return isWompiConfigured()
    ? { provider: wompiPaymentProvider, providerCode: "wompi" }
    : { provider: mockPaymentProvider, providerCode: "mock" };
}

