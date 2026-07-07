/**
 * Firma HMAC-SHA256 para el hub de pagos, en ambos sentidos:
 *  - ENTRADA: la app externa firma `${timestamp}.${rawBody}` con su `hmacSecret`
 *    y lo envía en `x-hub-signature` (+ `x-hub-timestamp`). Lo verificamos.
 *  - SALIDA: firmamos la notificación con el mismo esquema para que la app la
 *    verifique antes de confiar en el estado del pago.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Ventana de validez del timestamp (anti-replay): 5 minutos. */
const MAX_SKEW_MS = 5 * 60 * 1000;

export function signHubBody(secret: string, timestamp: string | number, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (!a || !b) return false;
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export function verifyHubSignature(opts: {
  secret: string;
  timestamp: string | number;
  rawBody: string;
  signature: string;
  nowMs: number;
}): { valid: boolean; reason?: string } {
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts)) return { valid: false, reason: "bad_timestamp" };
  if (Math.abs(opts.nowMs - ts) > MAX_SKEW_MS) return { valid: false, reason: "stale_timestamp" };
  const expected = signHubBody(opts.secret, opts.timestamp, opts.rawBody);
  return safeEqualHex(expected, opts.signature) ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}
