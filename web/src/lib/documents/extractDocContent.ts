import "server-only";

/**
 * Extrae el contenido de un documento subido para que la IA lo analice, sin
 * importar el formato:
 *  - Imagen (JPG/PNG/WEBP) → se envía como imagen a un modelo de VISIÓN.
 *  - PDF (con texto) → se extrae el TEXTO (unpdf) y se envía a un modelo de texto.
 *  - Word (.docx) → se extrae el TEXTO (mammoth).
 *  - PDF escaneado (sin texto) o formato no soportado → `unsupported` (revisión manual).
 *
 * Devuelve el modo y el contenido listo para el prompt.
 */
export type ExtractedContent =
  | { kind: "image"; imageDataUrl: string; mime: string }
  | { kind: "text"; text: string }
  | { kind: "unsupported"; reason: string };

const MAX_TEXT_CHARS = 15_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function guessMime(contentType: string, fileName: string): string {
  const ct = contentType.toLowerCase();
  if (ct.startsWith("image/")) return ct;
  const f = fileName.toLowerCase();
  if (f.endsWith(".png")) return "image/png";
  if (f.endsWith(".webp")) return "image/webp";
  if (f.endsWith(".jpg") || f.endsWith(".jpeg")) return "image/jpeg";
  if (f.endsWith(".pdf") || ct === "application/pdf") return "application/pdf";
  if (f.endsWith(".docx") || ct.includes("wordprocessingml")) return "docx";
  if (f.endsWith(".doc")) return "doc";
  return ct || "application/octet-stream";
}

export async function extractDocContent(
  bytes: Buffer,
  contentType: string,
  fileName: string,
): Promise<ExtractedContent> {
  const mime = guessMime(contentType ?? "", fileName ?? "");

  // Imágenes → visión.
  if (mime.startsWith("image/")) {
    if (bytes.length > MAX_IMAGE_BYTES) return { kind: "unsupported", reason: "too_large" };
    return { kind: "image", imageDataUrl: `data:${mime};base64,${bytes.toString("base64")}`, mime };
  }

  // PDF → texto (si es digital); si no hay texto (escaneado), revisión manual.
  if (mime === "application/pdf") {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractText(pdf, { mergePages: true });
      const clean = (typeof text === "string" ? text : (text as string[]).join("\n")).trim();
      if (clean.length < 20) return { kind: "unsupported", reason: "pdf_scanned" };
      return { kind: "text", text: clean.slice(0, MAX_TEXT_CHARS) };
    } catch {
      return { kind: "unsupported", reason: "pdf_error" };
    }
  }

  // Word .docx → texto.
  if (mime === "docx") {
    try {
      const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      const clean = (value ?? "").trim();
      if (clean.length < 20) return { kind: "unsupported", reason: "docx_empty" };
      return { kind: "text", text: clean.slice(0, MAX_TEXT_CHARS) };
    } catch {
      return { kind: "unsupported", reason: "docx_error" };
    }
  }

  // .doc antiguo u otros: no soportado (pide foto/PDF/Word).
  return { kind: "unsupported", reason: mime === "doc" ? "doc_legacy" : "unsupported_format" };
}
