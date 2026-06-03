// Construye la URL del Web Checkout de Wompi.
// El usuario es redirigido aquí para pagar. Wompi confirma el pago vía webhook.

import { buildIntegritySignature } from './signature'

const CHECKOUT_HOST_PROD = 'https://checkout.wompi.co/p/'
const CHECKOUT_HOST_TEST = 'https://checkout.co.uat.wompi.dev/p/'

export interface CheckoutOptions {
  publicKey: string         // pub_prod_... o pub_test_...
  integritySecret: string   // secret de integridad (NO el de eventos)
  reference: string         // ya construido por buildReference()
  amountInCents: number     // monto total en centavos COP
  currency?: 'COP'          // siempre COP por ahora
  redirectUrl: string       // URL absoluta a la que Wompi devuelve al usuario
  customerEmail?: string
  customerFullName?: string
  expirationTime?: string   // ISO 8601 opcional
  environment?: 'production' | 'sandbox'
}

export function buildCheckoutUrl(opts: CheckoutOptions): string {
  const env = opts.environment ?? (opts.publicKey.startsWith('pub_test_') ? 'sandbox' : 'production')
  const host = env === 'sandbox' ? CHECKOUT_HOST_TEST : CHECKOUT_HOST_PROD
  const currency = opts.currency ?? 'COP'

  const integrity = buildIntegritySignature({
    reference: opts.reference,
    amountInCents: opts.amountInCents,
    currency,
    expirationTime: opts.expirationTime,
    integritySecret: opts.integritySecret,
  })

  const params = new URLSearchParams()
  params.set('public-key', opts.publicKey)
  params.set('currency', currency)
  params.set('amount-in-cents', String(opts.amountInCents))
  params.set('reference', opts.reference)
  params.set('signature:integrity', integrity)
  params.set('redirect-url', opts.redirectUrl)
  if (opts.expirationTime) params.set('expiration-time', opts.expirationTime)
  if (opts.customerEmail) params.set('customer-data:email', opts.customerEmail)
  if (opts.customerFullName) params.set('customer-data:full-name', opts.customerFullName)

  return `${host}?${params.toString()}`
}
