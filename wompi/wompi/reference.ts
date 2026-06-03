// Reference scheme para distinguir transacciones entre apps del mismo comercio Wompi.
//
// Cada app define su PREFIX único:
//   swap_*       → AppStickers (esta app — prefix legacy, no renombrar)
//   transfdig_*  → transformacion-digital
//   arriendo_*   → arriendoseguro
//   ...
//
// Cuando se crea una transacción, el `reference` debe SIEMPRE empezar con el
// prefix propio de la app. Eso permite al webhook hub enrutar correctamente.

export const APP_PREFIX = 'swap'

// Construye un reference único para esta app: swap_<purpose>_<userIdNoHyphens>_<timestamp>
// El UUID se guarda COMPLETO (32 chars sin guiones) para evitar colisiones al
// reconstruirlo en el webhook.
export function buildReference(purpose: string, userId: string): string {
  const ts = Date.now()
  const cleanUid = userId.replace(/-/g, '')
  const cleanPurpose = purpose.replace(/[^a-z0-9]/gi, '')
  return `${APP_PREFIX}_${cleanPurpose}_${cleanUid}_${ts}`
}

// Reconstruye el UUID con guiones desde el slug de 32 chars del reference.
// UUID format: 8-4-4-4-12
export function uuidFromSlug(slug32: string): string | null {
  if (slug32.length !== 32) return null
  return [
    slug32.slice(0, 8),
    slug32.slice(8, 12),
    slug32.slice(12, 16),
    slug32.slice(16, 20),
    slug32.slice(20, 32),
  ].join('-')
}

// Extrae el prefijo de un reference dado. Devuelve null si no tiene formato esperado.
export function extractPrefix(reference: string): string | null {
  if (!reference) return null
  const idx = reference.indexOf('_')
  if (idx <= 0) return null
  return reference.slice(0, idx)
}

export function isOurs(reference: string): boolean {
  return extractPrefix(reference) === APP_PREFIX
}
