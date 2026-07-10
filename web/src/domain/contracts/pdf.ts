import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

/**
 * Renderiza el contrato a PDF con pdf-lib (JS puro, sin navegador headless: es
 * rápido y liviano en serverless). Como pdf-lib NO interpreta HTML/CSS, aquí
 * convertimos el HTML del contrato en una lista de BLOQUES con estilo
 * (títulos, párrafos, viñetas, filas de tabla) y los dibujamos con la fuente,
 * el tamaño y el espaciado adecuados, con salto de línea por ANCHO REAL. Así el
 * PDF sale ordenado y parecido a la vista previa (antes se aplanaba a texto
 * corrido, sin títulos ni espacios y con líneas cortadas).
 */

const WINANSI_REPLACEMENTS: Record<string, string> = {
  "…": "...", // …
  "—": "-", // —
  "–": "-", // –
  "−": "-", // − (signo menos)
  "«": '"', // «
  "»": '"', // »
  "“": '"', // “
  "”": '"', // ”
  "„": '"', // „
  "‘": "'", // ‘
  "’": "'", // ’
  "‚": "'", // ‚
  "•": "-", // • (viñeta)
  "·": ".", // ·
  " ": " ", // espacio no separable
  " ": " ", // espacio fino
  "​": "", // zero-width space
  "´": "'", // ´
  "ˋ": "'", // ˋ
  "→": "->",
  "←": "<-",
};

function sanitizeForWinAnsi(input: string): string {
  let out = "";
  for (const ch of input) {
    const replacement = WINANSI_REPLACEMENTS[ch];
    if (replacement !== undefined) { out += replacement; continue; }
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) out += ch;
    else if (code >= 0x20 && code <= 0x7e) out += ch;
    else if (code >= 0xa0 && code <= 0xff) out += ch;
    else out += "?";
  }
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replaceAll(/&nbsp;/gi, " ").replaceAll(/&amp;/gi, "&").replaceAll(/&lt;/gi, "<").replaceAll(/&gt;/gi, ">")
    .replaceAll(/&laquo;/gi, '"').replaceAll(/&raquo;/gi, '"').replaceAll(/&ldquo;/gi, '"').replaceAll(/&rdquo;/gi, '"')
    .replaceAll(/&lsquo;/gi, "'").replaceAll(/&rsquo;/gi, "'").replaceAll(/&hellip;/gi, "...").replaceAll(/&mdash;/gi, "-")
    .replaceAll(/&ndash;/gi, "-").replaceAll(/&deg;/gi, "°").replaceAll(/&ordm;/gi, "º").replaceAll(/&middot;/gi, "-")
    .replaceAll(/&#(\d+);/g, (_m, n: string) => { try { return String.fromCodePoint(Number(n)); } catch { return ""; } })
    .replaceAll(/&#x([0-9a-f]+);/gi, (_m, n: string) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ""; } });
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

type BlockKind = "H1" | "H2" | "H3" | "P" | "LI" | "ROW";
type Block = { kind: BlockKind; text: string };

const OPEN = "";
const CLOSE = "";

/** Convierte el HTML del contrato en bloques ordenados con su tipo. */
export function htmlToBlocks(html: string): Block[] {
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "");

  // Tablas → una fila por bloque, con las celdas unidas por un separador.
  s = s.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_m, inner: string) => {
    const cells = [...inner.matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((c) => stripTags(c[1]))
      .filter(Boolean);
    return cells.length ? `${OPEN}ROW|${cells.join("   ·   ")}${CLOSE}` : "";
  });
  s = s.replace(/<\/?(table|tbody|thead|tfoot|colgroup|col)[^>]*>/gi, " ");
  s = s.replace(/<br\s*\/?>/gi, "\n");

  const tagKind: Record<string, BlockKind> = { h1: "H1", h2: "H2", h3: "H3", h4: "H3", h5: "H3", h6: "H3", p: "P", li: "LI" };
  s = s.replace(/<(h[1-6]|p|li)[^>]*>/gi, (_m, tag: string) => `${OPEN}${tagKind[tag.toLowerCase()]}|`);
  s = s.replace(/<\/(h[1-6]|p|li)>/gi, CLOSE);
  s = s.replace(/<[^>]+>/g, " "); // resto de etiquetas → espacio
  s = decodeEntities(s);

  const blocks: Block[] = [];
  const kindRe = new RegExp(`${OPEN}(H1|H2|H3|P|LI|ROW)\\|([\\s\\S]*)`);
  for (const part of s.split(CLOSE)) {
    const m = part.match(kindRe);
    if (m) {
      const text = m[2].replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").trim();
      if (text) blocks.push({ kind: m[1] as BlockKind, text });
    } else {
      const text = part.split(OPEN).join("").replace(/[ \t]+/g, " ").trim();
      if (text) blocks.push({ kind: "P", text });
    }
  }
  return blocks;
}

/** Ajuste de línea por ANCHO real de la fuente (no por conteo de caracteres). */
function wrapByWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let cur = "";
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(sanitizeForWinAnsi(candidate), size) <= maxWidth) {
        cur = candidate;
      } else {
        if (cur) out.push(cur);
        cur = w;
        while (font.widthOfTextAtSize(sanitizeForWinAnsi(cur), size) > maxWidth && cur.length > 1) {
          let cut = cur.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(sanitizeForWinAnsi(cur.slice(0, cut)), size) > maxWidth) cut--;
          out.push(cur.slice(0, cut));
          cur = cur.slice(cut);
        }
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

const STYLE: Record<BlockKind, { bold: boolean; size: number; before: number; after: number; bullet?: boolean }> = {
  H1: { bold: true, size: 15, before: 12, after: 6 },
  H2: { bold: true, size: 12, before: 10, after: 4 },
  H3: { bold: true, size: 10.5, before: 8, after: 3 },
  P: { bold: false, size: 9.5, before: 0, after: 6 },
  LI: { bold: false, size: 9.5, before: 0, after: 3, bullet: true },
  ROW: { bold: false, size: 9, before: 0, after: 3 },
};

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
  const margin = 46;
  const ink = rgb(0.08, 0.11, 0.15);
  const gray = rgb(0.45, 0.47, 0.52);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const draw = (text: string, x: number, size: number, f: PDFFont, color = ink) => {
    let line = sanitizeForWinAnsi(text);
    try {
      page.drawText(line, { x, y, size, font: f, color });
    } catch {
      line = line.replace(/[^\x20-\x7E]/g, "?");
      page.drawText(line, { x, y, size, font: f, color });
    }
  };
  const feed = (h: number) => {
    y -= h;
    if (y <= margin) { page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
  };

  // Encabezado técnico (pequeño, gris).
  const header = [
    `Contrato ${params.contractId} · version ${params.versionNumber}`,
    `Hash documental: ${params.documentHash}`,
    `Generado: ${params.generatedAt}`,
  ];
  for (const h of header) { draw(h, margin, 8, font, gray); feed(11); }
  feed(8);

  const usableFull = pageWidth - 2 * margin;
  for (const block of htmlToBlocks(params.html)) {
    const st = STYLE[block.kind];
    const f = st.bold ? fontBold : font;
    const indent = st.bullet ? 14 : 0;
    const lines = wrapByWidth(block.text, f, st.size, usableFull - indent);
    if (!lines.length) continue;
    feed(st.before);
    const lh = st.size * 1.36;
    lines.forEach((ln, k) => {
      if (y - lh <= margin) { page = pdf.addPage([pageWidth, pageHeight]); y = pageHeight - margin; }
      if (st.bullet && k === 0) draw("·", margin, st.size, f);
      draw(ln, margin + indent, st.size, f);
      y -= lh;
    });
    feed(st.after);
  }

  return pdf.save();
}
