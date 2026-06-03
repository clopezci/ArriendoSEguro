import { describe, it, expect } from 'vitest'
import { buildCheckoutUrl } from './checkout-url'

describe('buildCheckoutUrl', () => {
  const baseOpts = {
    publicKey: 'pub_prod_xxx',
    integritySecret: 'integrity_xxx',
    reference: 'swap_premium_abc_123',
    amountInCents: 1490000,
    redirectUrl: 'https://appstickers.app/payment/wompi/return',
  }

  it('uses production host with pub_prod_ key', () => {
    const url = buildCheckoutUrl(baseOpts)
    expect(url.startsWith('https://checkout.wompi.co/p/?')).toBe(true)
  })

  it('uses sandbox host with pub_test_ key', () => {
    const url = buildCheckoutUrl({ ...baseOpts, publicKey: 'pub_test_xxx' })
    expect(url.startsWith('https://checkout.co.uat.wompi.dev/p/?')).toBe(true)
  })

  it('respects explicit environment over key prefix', () => {
    const url = buildCheckoutUrl({ ...baseOpts, environment: 'sandbox' })
    expect(url.startsWith('https://checkout.co.uat.wompi.dev/p/?')).toBe(true)
  })

  it('includes all required query params', () => {
    const url = buildCheckoutUrl(baseOpts)
    const params = new URL(url).searchParams
    expect(params.get('public-key')).toBe('pub_prod_xxx')
    expect(params.get('currency')).toBe('COP')
    expect(params.get('amount-in-cents')).toBe('1490000')
    expect(params.get('reference')).toBe('swap_premium_abc_123')
    expect(params.get('signature:integrity')).toMatch(/^[a-f0-9]{64}$/)
    expect(params.get('redirect-url')).toBe('https://appstickers.app/payment/wompi/return')
  })

  it('includes customer data when provided', () => {
    const url = buildCheckoutUrl({
      ...baseOpts,
      customerEmail: 'user@test.com',
      customerFullName: 'Carlos Lopez',
    })
    const params = new URL(url).searchParams
    expect(params.get('customer-data:email')).toBe('user@test.com')
    expect(params.get('customer-data:full-name')).toBe('Carlos Lopez')
  })

  it('omits customer data when not provided', () => {
    const url = buildCheckoutUrl(baseOpts)
    const params = new URL(url).searchParams
    expect(params.has('customer-data:email')).toBe(false)
    expect(params.has('customer-data:full-name')).toBe(false)
  })

  it('signature changes if amount changes', () => {
    const a = buildCheckoutUrl(baseOpts)
    const b = buildCheckoutUrl({ ...baseOpts, amountInCents: 1090000 })
    const sigA = new URL(a).searchParams.get('signature:integrity')
    const sigB = new URL(b).searchParams.get('signature:integrity')
    expect(sigA).not.toBe(sigB)
  })
})
