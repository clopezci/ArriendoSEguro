// Helpers de firma para Wompi (integridad y webhook).
// PORTABLE: copy/paste entre repos sin cambios.
//
// Wompi requiere dos firmas distintas:
//
// 1. Integrity signature (al CREAR una transacción):
//    sha256(reference + amountInCents + currency + integritySecret)
//    Va en el query param `signature:integrity` del checkout URL.
//
// 2. Event checksum (al RECIBIR un webhook):
//    sha256(concat de propiedades indicadas + timestamp + eventsSecret)
//    Viene en el body como `signature.checksum` y se valida.

import { createHash } from 'crypto'

export function buildIntegritySignature(opts: {
  reference: string
  amountInCents: number
  currency: string
  expirationTime?: string
  integritySecret: string
}): string {
  const base = opts.expirationTime
    ? `${opts.reference}${opts.amountInCents}${opts.currency}${opts.expirationTime}${opts.integritySecret}`
    : `${opts.reference}${opts.amountInCents}${opts.currency}${opts.integritySecret}`
  return createHash('sha256').update(base).digest('hex')
}

export interface WebhookSignaturePayload {
  signature: {
    properties: string[]
    checksum: string
  }
  data: Record<string, unknown> & { transaction: Record<string, unknown> }
  timestamp: number
}

// Valida la firma del webhook. Wompi indica en `signature.properties` qué
// campos del payload concatenar; luego concatena timestamp + eventsSecret
// y hashea sha256. Si coincide con `signature.checksum`, el webhook es
// auténtico.
export function verifyWebhookChecksum(payload: WebhookSignaturePayload, eventsSecret: string): boolean {
  if (!payload?.signature?.properties || !payload.signature.checksum) return false

  // Resolve cada property como path dotted: "transaction.id", "transaction.status", etc.
  const parts = payload.signature.properties.map((prop) => {
    const segments = prop.split('.')
    let cur: unknown = payload.data
    for (const seg of segments) {
      if (cur && typeof cur === 'object' && seg in (cur as object)) {
        cur = (cur as Record<string, unknown>)[seg]
      } else {
        return ''
      }
    }
    return cur == null ? '' : String(cur)
  })

  const base = parts.join('') + payload.timestamp + eventsSecret
  const computed = createHash('sha256').update(base).digest('hex')
  return computed === payload.signature.checksum
}
