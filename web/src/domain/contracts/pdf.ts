import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Tabla de transliteración para caracteres que NO están en `WinAnsiEncoding`
 * (la codificación que usan las fuentes estándar Helvetica/Times de PDF).
 *
 * Si dejamos pasar uno solo de estos caracteres al `page.drawText`, pdf-lib
 * lanza un error tipo `WinAnsi cannot encode "…"` y el endpoint de
 * generación de PDF responde con un genérico "No se pudo generar el PDF".
 *
 * Estos chars aparecen en la plantilla de contrato (puntos suspensivos
 * tipográficos, comillas españolas, guion largo, etc.). Aquí los mapeamos
 * a sus equivalentes ASCII más cercanos para que el PDF se pueda generar
 * siempre. La copia en pantalla del contrato sigue mostrando el carácter
 * original; el reemplazo solo aplica para el texto plano que se imprime
 * en el PDF a través de Helvetica estándar.
 */
const WINANSI_REPLACEMENTS: Record<string, string> = {
  "\u2026": "...", // …
  "\u2014": "-", // —
  "\u2013": "-", // –
  "\u2212": "-", // − (signo menos)
  "\u00AB": '"', // «
  "\u00BB": '"', // »
  "\u201C": '"', // “
  "\u201D": '"', // ”
  "\u201E": '"', // „
  "\u2018": "'", // ‘
  "\u2019": "'", // ’
  "\u201A": "'", // ‚
  "\u2022": "-", // • (viñeta)
  "\u00B7": ".", // ·
  "\u00A0": " ", // espacio no separable
  "\u202F": " ", // espacio fino
  "\u200B": "", // zero-width space
  "\u00B4": "'", // ´
  "\u02CB": "'", // ˋ
  "\u2192": "->",
  "\u2190": "<-",
};

function sanitizeForWinAnsi(input: string): string {
  let out = "";
  for (const ch of input) {
    const replacement = WINANSI_REPLACEMENTS[ch];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    // WinAnsi cubre 0x20..0x7E (ASCII imprimible) + 0xA0..0xFF (Latin-1).
    // Cualquier otro punto Unicode no es codificable. Lo reemplazamos por
    // "?" para no romper el render del PDF.
    if (code === 0x09 || code === 0x0A || code === 0x0D) {
      out += ch;
    } else if (code >= 0x20 && code <= 0x7e) {
      out += ch;
    } else if (code >= 0xa0 && code <= 0xff) {
      out += ch;
    } else {
      out += "?";
    }
  }
  return out;
}

function htmlToText(html: string): string {
  return html
    .replaceAll(/<style[\s\S]*?<\/style>/gi, " ")
    .replaceAll(/<script[\s\S]*?<\/script>/gi, " ")
    // Bloques (títulos, párrafos): separación de párrafo = línea en blanco.
    .replaceAll(/<\/(h1|h2|h3|h4|p|article|div|section)>/gi, "\n\n")
    // Ítems de lista: un salto simple (no doble) para que la lista quede compacta.
    .replaceAll(/<\/(li|ol|ul)>/gi, "\n")
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/&nbsp;/g, " ")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&laquo;/g, '"')
    .replaceAll(/&raquo;/g, '"')
    .replaceAll(/&ldquo;/g, '"')
    .replaceAll(/&rdquo;/g, '"')
    .replaceAll(/&lsquo;/g, "'")
    .replaceAll(/&rsquo;/g, "'")
    .replaceAll(/&hellip;/g, "...")
    .replaceAll(/&mdash;/g, "-")
    .replaceAll(/&ndash;/g, "-")
    .replaceAll(/\s+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(input: string, maxChars = 92): string[] {
  const lines: string[] = [];
  const paragraphs = input.split("\n");
  for (const paragraph of paragraphs) {
    const text = paragraph.trim();
    if (!text) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of text.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function renderContractPdfFromHtml(params: {
  html: string;
  contractId: string;
  contractVersionId: string;
  versionNumber: number;
  documentHash: string;
  generatedAt: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 42;
  const lineHeight = 14;

  const normalizedText = sanitizeForWinAnsi(htmlToText(params.html));
  const headerLines = [
    "Arriendo Seguro - Contrato de arrendamiento",
    `Contrato: ${params.contractId}`,
    `Version ID: ${params.contractVersionId}`,
    `Version numero: ${params.versionNumber}`,
    `Hash documental: ${params.documentHash}`,
    `Fecha de generacion PDF: ${params.generatedAt}`,
    "",
  ].map((entry) => sanitizeForWinAnsi(entry));
  const bodyLines = wrapText(normalizedText).map((entry) => sanitizeForWinAnsi(entry));
  const lines = [...headerLines, ...bodyLines];

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (y <= margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    const isHeader = i < headerLines.length - 1;
    try {
      // Sin `maxWidth`: el ajuste de línea ya lo hace `wrapText` por palabras.
      // Dejar que pdf-lib re-envuelva aquí causaba cortes a mitad de frase y
      // líneas superpuestas (porque la posición vertical la controlamos nosotros).
      page.drawText(line, {
        x: margin,
        y,
        size: isHeader ? 10 : 9,
        font: isHeader ? fontBold : font,
        color: rgb(0.08, 0.11, 0.15),
      });
    } catch (drawError) {
      // Defensa adicional: si pdf-lib aún no logra codificar la línea
      // (p. ej. por un Unicode que escapó al sanitizador), forzamos un
      // fallback ASCII puro para no abortar todo el PDF.
      const ascii = line.replace(/[^\x20-\x7E]/g, "?");
      if (process.env.NODE_ENV !== "production") {
        console.warn("renderContractPdfFromHtml: line fell back to ASCII", drawError);
      }
      page.drawText(ascii, {
        x: margin,
        y,
        size: isHeader ? 10 : 9,
        font: isHeader ? fontBold : font,
        color: rgb(0.08, 0.11, 0.15),
      });
    }
    y -= lineHeight;
  }

  return pdf.save();
}

