import "server-only";
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";

/**
 * TOTP (RFC 6238) con crypto nativo — sin dependencias. Para el segundo factor
 * del panel admin: el admin escanea un QR en Google Authenticator/Authy y luego
 * valida un código de 6 dígitos. También genera/verifica códigos de respaldo.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Codifica bytes a Base32 (RFC 4648, sin padding) — formato de secreto TOTP. */
function toBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decodifica Base32 a bytes. Ignora espacios y mayúsc/minúsc. */
function fromBase32(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Genera un secreto TOTP nuevo (Base32, 20 bytes de entropía). */
export function generateTotpSecret(): string {
  return toBase32(randomBytes(20));
}

/** URI `otpauth://` para el QR del autenticador. */
export function buildOtpauthUri(secret: string, accountLabel: string, issuer = "ArriendoSeguro"): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Código HOTP de 6 dígitos para un contador dado. */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // Contador de 64 bits big-endian (los primeros 32 bits son 0 en la práctica).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 1_000_000).toString().padStart(6, "0");
}

/**
 * Verifica un código TOTP contra el secreto (Base32). `window` permite ±N pasos
 * de 30s para tolerar desfase de reloj (por defecto ±1). Comparación en tiempo
 * constante. No lanza.
 */
export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  const code = (token || "").replace(/\D/g, "");
  if (code.length !== 6) return false;
  let key: Buffer;
  try {
    key = fromBase32(secretBase32);
  } catch {
    return false;
  }
  if (key.length === 0) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    const candidate = hotp(key, step + i);
    if (candidate.length === code.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}

// --- Códigos de respaldo -------------------------------------------------------

/** Genera `count` códigos de respaldo legibles (xxxx-xxxx). */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString("hex").slice(0, 8); // 8 hex chars
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

/** Normaliza un código de respaldo (sin guiones/espacios, minúsculas). */
export function normalizeBackupCode(code: string): string {
  return (code || "").replace(/[\s-]/g, "").toLowerCase();
}

/** Hash (sha256 hex) de un código de respaldo, para guardar sin exponerlo. */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}
