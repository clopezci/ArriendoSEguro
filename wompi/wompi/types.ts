// Tipos compartidos del módulo Wompi.
// Este archivo es PORTABLE — puede copiarse tal cual entre repos.

export type WompiTransactionStatus = 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | 'PENDING'

export interface WompiTransaction {
  id: string
  status: WompiTransactionStatus
  reference: string
  amount_in_cents: number
  currency: string
  customer_email?: string | null
  payment_method_type?: string
  finalized_at?: string
  created_at?: string
}

export interface WompiEvent {
  event: 'transaction.updated' | string
  data: {
    transaction: WompiTransaction
  }
  sent_at: string
  timestamp: number
  signature?: {
    properties: string[]
    checksum: string
  }
  environment?: 'prod' | 'test'
}

export type WompiRouterOutcome =
  | { kind: 'processed', notes: string }
  | { kind: 'forwarded', notes: string, forwardedTo: string }
  // forward_failed → Wompi debe reintentar (responder 500 al webhook)
  | { kind: 'forward_failed', notes: string, forwardedTo: string }
  | { kind: 'rejected', notes: string }
  | { kind: 'unknown', notes: string }
