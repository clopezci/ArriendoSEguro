import { describe, it, expect } from 'vitest'
import { APP_PREFIX, buildReference, extractPrefix, isOurs, uuidFromSlug } from './reference'

describe('buildReference', () => {
  it('produces a valid reference with our app prefix', () => {
    const uid = 'a3f40000-1234-abcd-5678-9012345abcde'
    const ref = buildReference('premium', uid)
    expect(ref.startsWith(`${APP_PREFIX}_premium_`)).toBe(true)
    expect(ref.split('_').length).toBe(4)
  })

  it('strips hyphens from UUID', () => {
    const uid = 'a3f40000-1234-abcd-5678-9012345abcde'
    const ref = buildReference('premium', uid)
    const parts = ref.split('_')
    // UUID original sin guiones (8+4+4+4+12 = 32 chars)
    expect(parts[2]).toBe('a3f400001234abcd56789012345abcde')
    expect(parts[2].length).toBe(32)
  })

  it('sanitizes the purpose (only alphanumerics)', () => {
    const uid = '11111111-2222-3333-4444-555555555555'
    const ref = buildReference('pre/mi#um!', uid)
    expect(ref.split('_')[1]).toBe('premium')
  })

  it('two consecutive calls produce different references (timestamp differs)', async () => {
    const uid = '11111111-2222-3333-4444-555555555555'
    const a = buildReference('premium', uid)
    await new Promise((r) => setTimeout(r, 2))
    const b = buildReference('premium', uid)
    expect(a).not.toBe(b)
  })
})

describe('uuidFromSlug', () => {
  it('reconstructs UUID with hyphens', () => {
    const slug = 'a3f400001234abcd56789012345abcde' // exactly 32 chars
    const uuid = uuidFromSlug(slug)
    expect(uuid).toBe('a3f40000-1234-abcd-5678-9012345abcde')
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('returns null for slug != 32 chars', () => {
    expect(uuidFromSlug('short')).toBeNull()
    expect(uuidFromSlug('a'.repeat(33))).toBeNull()
    expect(uuidFromSlug('')).toBeNull()
  })

  it('roundtrips with buildReference', () => {
    const uid = 'a3f40000-1234-abcd-5678-9012345abcde'
    const ref = buildReference('premium', uid)
    const cleanUid = ref.split('_')[2]
    const reconstructed = uuidFromSlug(cleanUid)
    expect(reconstructed).toBe(uid)
  })
})

describe('extractPrefix', () => {
  it('returns prefix before first underscore', () => {
    expect(extractPrefix('swap_premium_xxx_123')).toBe('swap')
    expect(extractPrefix('transfdig_pago_yyy')).toBe('transfdig')
  })

  it('returns null for empty or no-underscore strings', () => {
    expect(extractPrefix('')).toBeNull()
    expect(extractPrefix('nounderscore')).toBeNull()
  })
})

describe('isOurs', () => {
  it('returns true for our prefix', () => {
    expect(isOurs('swap_premium_abc_123')).toBe(true)
  })

  it('returns false for other prefixes', () => {
    expect(isOurs('transfdig_pago_xxx')).toBe(false)
    expect(isOurs('arriendo_subs_yyy')).toBe(false)
    expect(isOurs('')).toBe(false)
  })
})
