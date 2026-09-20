import "server-only";
import crypto from "node:crypto";

/**
 * Cifrado de secretos de agencia (Nivel A): las llaves de API de cada agencia se
 * guardan CIFRADAS con AES-256-GCM usando una clave maestra en variable de
 * entorno (`AGENCY_SECRETS_KEY`, 32 bytes en base64), fuera de la base de datos.
 * Nunca se devuelven al navegador ni se registran en logs; solo se descifran en
 * el servidor al momento de usarlas. Upgradeable a Google Cloud KMS sin cambiar
 * los llamadores.
 */

function masterKey(): Buffer | null {
  const b64 = process.env.AGENCY_SECRETS_KEY?.trim();
  if (!b64) return null;
  try {
    const k = Buffer.from(b64, "base64");
    return k.length === 32 ? k : null;
  } catch {
    return null;
  }
}

export function secretsConfigured(): boolean {
  return masterKey() !== null;
}

/** Cifra un secreto. Devuelve "iv.tag.data" en base64, o null si no hay clave maestra. */
export function encryptSecret(plain: string): string | null {
  const k = masterKey();
  if (!k) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

/** Descifra un secreto. Devuelve el texto plano, o null si falla/no hay clave. */
export function decryptSecret(blob: string | null | undefined): string | null {
  const k = masterKey();
  if (!k || !blob) return null;
  try {
    const [ivb, tagb, encb] = blob.split(".");
    if (!ivb || !tagb || !encb) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(ivb, "base64"));
    decipher.setAuthTag(Buffer.from(tagb, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encb, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
