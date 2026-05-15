import { readFile } from "node:fs/promises";
import { getStorage } from "firebase-admin/storage";

/** Interpreta `gs://bucket/object/path...` para descarga con Admin SDK. */
function parseGsUri(gs: string): { bucket: string; objectPath: string } | null {
  if (!gs.startsWith("gs://")) return null;
  const rest = gs.slice(5);
  const i = rest.indexOf("/");
  if (i <= 0) return null;
  const bucket = rest.slice(0, i);
  const objectPath = rest.slice(i + 1);
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

async function fetchHttpBytes(url: string): Promise<Buffer | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45_000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    clearTimeout(t);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

/**
 * Lee bytes de un PDF guardado en disco local o en Cloud Storage (`gs://`),
 * o descarga desde una URL HTTPS (p. ej. URL firmada temporal).
 */
export async function readPdfBytesFlexible(fields: {
  pdfStoragePath?: string | null;
  pdfUrl?: string | null;
}): Promise<Buffer | null> {
  const storagePath = fields.pdfStoragePath?.trim();
  if (storagePath) {
    const gs = parseGsUri(storagePath);
    if (gs) {
      try {
        const bucket = getStorage().bucket(gs.bucket);
        const [buf] = await bucket.file(gs.objectPath).download();
        if (buf?.length) return buf;
      } catch {
        // Storage no inicializado o objeto inexistente: intentar URL.
      }
    } else {
      try {
        const buf = await readFile(storagePath);
        if (buf.length) return buf;
      } catch {
        // Ruta local inválida.
      }
    }
  }
  const url = fields.pdfUrl?.trim();
  if (url && /^https?:\/\//i.test(url)) {
    return fetchHttpBytes(url);
  }
  return null;
}
