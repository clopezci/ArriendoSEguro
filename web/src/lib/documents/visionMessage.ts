import "server-only";
import type { ExtractedContent } from "@/lib/documents/extractDocContent";

/**
 * Construye el `content` del mensaje de usuario para la IA a partir del
 * contenido extraído. Soporta:
 *  - imagen  → parte `image_url` (base64)
 *  - pdf     → parte `file` (base64) — la IA de visión lee el PDF (texto o escaneado)
 *  - texto   → string con el texto del documento
 *
 * OpenAI (gpt-4o / gpt-4o-mini) acepta la parte `file` con `file_data` para PDF.
 */
export function buildUserContent(prompt: string, ex: ExtractedContent): unknown {
  if (ex.kind === "image") {
    return [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: ex.imageDataUrl } },
    ];
  }
  if (ex.kind === "pdf") {
    return [
      { type: "text", text: prompt },
      { type: "file", file: { filename: "documento.pdf", file_data: ex.pdfDataUrl } },
    ];
  }
  if (ex.kind === "text") {
    return `${prompt}\n\nTEXTO DEL DOCUMENTO:\n"""\n${ex.text}\n"""`;
  }
  return prompt;
}

/** ¿El contenido requiere el proveedor de VISIÓN (imagen o PDF-archivo)? */
export function needsVision(ex: ExtractedContent): boolean {
  return ex.kind === "image" || ex.kind === "pdf";
}
