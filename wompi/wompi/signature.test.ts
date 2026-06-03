import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { buildIntegritySignature, verifyWebhookChecksum } from './signature'

describe('buildIntegritySignature', () => {
  it('builds sha256 of reference+amount+currency+secret', () => {
    const sig = buildIntegritySignature({
      reference: 'swap_premium_abc_123',
      amountInCents: 1490000,
      currency: 'COP',
      integritySecret: 'test_secret',
    })
    const expected = createHash('sha256')
      .update('swap_premium_abc_1231490000COPtest_secret')
      .digest('hex')
    expect(sig).toBe(expected)
  })

  it('includes expirationTime when provided', () => {
    const sig = buildIntegritySignature({
      reference: 'swap_premium_xyz_456',
      amountInCents: 270000,
      currency: 'COP',
      expirationTime: '2026-12-31T23:59:59Z',
      integritySecret: 'secret',
    })
    const expected = createHash('sha256')
      .update('swap_premium_xyz_456270000COP2026-12-31T23:59:59Zsecret')
      .digest('hex')
    expect(sig).toBe(expected)
  })

  it('different secrets produce different signatures', () => {
    const a = buildIntegritySignature({
      reference: 'ref1', amountInCents: 100, currency: 'COP', integritySecret: 'A',
    })
    const b = buildIntegritySignature({
      reference: 'ref1', amountInCents: 100, currency: 'COP', integritySecret: 'B',
    })
    expect(a).not.toBe(b)
  })
})

describe('verifyWebhookChecksum', () => {
  function buildPayload(transaction: Record<string, unknown>, timestamp: number, secret: string) {
    const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents']
    const parts = properties.map((p) => {
      const segs = p.split('.')
      let cur: unknown = { transaction }
      for (const s of segs) cur = (cur as Record<string, unknown>)[s]
      return String(cur)
    })
    const base = parts.join('') + timestamp + secret
    const checksum = createHash('sha256').update(base).digest('hex')
    return {
      signature: { properties, checksum },
      data: { transaction },
      timestamp,
    }
  }

  it('returns true for valid checksum', () => {
    const txn = { id: 'txn_1', status: 'APPROVED', amount_in_cents: 1490000 }
    const ts = 1779749162462
    const secret = 'events_secret_xyz'
    const payload = buildPayload(txn, ts, secret)
    expect(verifyWebhookChecksum(payload, secret)).toBe(true)
  })

  it('returns false for tampered transaction data', () => {
    const txn = { id: 'txn_1', status: 'APPROVED', amount_in_cents: 1490000 }
    const ts = 1779749162462
    const secret = 'events_secret_xyz'
    const payload = buildPayload(txn, ts, secret)
    // attacker changes status but not checksum
    payload.data.transaction.status = 'DECLINED'
    expect(verifyWebhookChecksum(payload, secret)).toBe(false)
  })

  it('returns false for wrong secret', () => {
    const txn = { id: 'txn_1', status: 'APPROVED', amount_in_cents: 1490000 }
    const ts = 1779749162462
    const payload = buildPayload(txn, ts, 'correct_secret')
    expect(verifyWebhookChecksum(payload, 'wrong_secret')).toBe(false)
  })

  it('returns false when signature is missing', () => {
    // @ts-expect-error testing invalid input intentionally
    expect(verifyWebhookChecksum({ data: { transaction: {} }, timestamp: 0 }, 'secret')).toBe(false)
  })

  it('handles nested missing properties gracefully', () => {
    const payload = {
      signature: { properties: ['transaction.missing_field'], checksum: 'whatever' },
      data: { transaction: { id: 'x' } as Record<string, unknown> },
      timestamp: 1,
    }
    // El campo no existe → genera string vacío en su lugar → checksum no coincide → false
    expect(verifyWebhookChecksum(payload, 'secret')).toBe(false)
  })
})
