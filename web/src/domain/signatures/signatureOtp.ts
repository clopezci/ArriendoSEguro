import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/** TTL del código OTP (Bloque 7 / plan). */
export const SIGNATURE_OTP_TTL_MS = 10 * 60 * 1000;

/** Máximo de intentos fallidos de verificación por código enviado. */
export const SIGNATURE_OTP_MAX_VERIFY_ATTEMPTS = 5;

/** Mínimo entre envíos de código al mismo enlace (anti-spam). */
export const SIGNATURE_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateSixDigitOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * No guardamos el código en claro: solo el hash con sal derivada del token de firma.
 */
export function hashOtpForSignature(tokenHash: string, code: string): string {
  return createHash("sha256").update(`${tokenHash}:${code}`, "utf8").digest("hex");
}

export function verifyOtpCode(storedHash: string, tokenHash: string, code: string): boolean {
  const attempt = hashOtpForSignature(tokenHash, code.trim());
  try {
    const a = Buffer.from(storedHash, "hex");
    const b = Buffer.from(attempt, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
