import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de descarga firmado (HMAC) para servir PDFs por enlace `<a href>` sin
 * abrir el recurso a cualquiera que adivine/filtre el id. El token no se puede
 * FALSIFICAR sin el secreto de servidor y CADUCA. Se usa como alternativa a la
 * auth por cabecera (que un enlace no puede enviar). En producción los PDFs se
 * sirven por URL firmada de Storage; esto endurece el fallback local.
 */
function secret(): string {
  return process.env.DOWNLOAD_SIGNING_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
}

const DEFAULT_TTL = 60 * 60 * 24 * 90; // 90 días

export function signDownloadToken(id: string, ttlSeconds: number = DEFAULT_TTL): string | null {
  const s = secret();
  if (!s || !id) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", s).update(`${id}.${exp}`).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyDownloadToken(id: string, token: string | null | undefined): boolean {
  const s = secret();
  if (!s || !id || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !sig) return false;
  const expected = createHmac("sha256", s).update(`${id}.${exp}`).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
