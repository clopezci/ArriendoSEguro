/**
 * Constructor genérico de la URL del Web Checkout de Wompi. Lo usan tanto el
 * cobro propio del Plan Plus como el hub de pagos (apps externas), todos sobre
 * la MISMA cuenta Wompi central de ArriendoSeguro.
 */

import { buildWompiIntegritySignature } from "./wompi-signature";

/**
 * Entorno de Wompi: `WOMPI_ENVIRONMENT` y, si no está, se infiere del prefijo de
 * la llave pública (`pub_test_` = sandbox).
 */
export function wompiIsSandbox(): boolean {
  const env = (process.env.WOMPI_ENVIRONMENT ?? "").trim().toLowerCase();
  if (env === "production" || env === "prod") return false;
  if (env === "sandbox" || env === "test") return true;
  return (process.env.WOMPI_PUBLIC_KEY ?? "").startsWith("pub_test_");
}

/** API REST de Wompi (consultar transacciones). */
export function wompiApiBaseUrl(): string {
  return wompiIsSandbox() ? "https://sandbox.wompi.co/v1" : "https://production.wompi.co/v1";
}

/** Web Checkout de Wompi (redirección del usuario para pagar). */
export function wompiCheckoutHost(): string {
  return wompiIsSandbox() ? "https://checkout.co.uat.wompi.dev/p/" : "https://checkout.wompi.co/p/";
}

export function buildWompiCheckoutUrl(opts: {
  reference: string;
  amountInCents: number;
  currency: string;
  redirectUrl: string;
  customerEmail?: string;
  customerFullName?: string;
}): string {
  const publicKey = process.env.WOMPI_PUBLIC_KEY ?? "";
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET ?? "";
  const integrity = buildWompiIntegritySignature({
    reference: opts.reference,
    amountInCents: opts.amountInCents,
    currency: opts.currency,
    integritySecret,
  });

  const params = new URLSearchParams();
  params.set("public-key", publicKey);
  params.set("currency", opts.currency);
  params.set("amount-in-cents", String(opts.amountInCents));
  params.set("reference", opts.reference);
  params.set("signature:integrity", integrity);
  params.set("redirect-url", opts.redirectUrl);
  if (opts.customerEmail) params.set("customer-data:email", opts.customerEmail);
  if (opts.customerFullName) params.set("customer-data:full-name", opts.customerFullName);

  return `${wompiCheckoutHost()}?${params.toString()}`;
}
