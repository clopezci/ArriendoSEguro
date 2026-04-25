import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function htmlToText(html: string): string {
  return html
    .replaceAll(/<style[\s\S]*?<\/style>/gi, " ")
    .replaceAll(/<script[\s\S]*?<\/script>/gi, " ")
    .replaceAll(/<\/(h1|h2|h3|p|li|ol|ul|article|div)>/gi, "\n")
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/&nbsp;/g, " ")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/\s+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(input: string, maxChars = 98): string[] {
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

  const normalizedText = htmlToText(params.html);
  const headerLines = [
    "Arriendo Seguro - Contrato de arrendamiento",
    `Contrato: ${params.contractId}`,
    `Version ID: ${params.contractVersionId}`,
    `Version numero: ${params.versionNumber}`,
    `Hash documental: ${params.documentHash}`,
    `Fecha de generacion PDF: ${params.generatedAt}`,
    "",
  ];
  const bodyLines = wrapText(normalizedText);
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
    page.drawText(line, {
      x: margin,
      y,
      size: isHeader ? 10 : 9,
      font: isHeader ? fontBold : font,
      color: rgb(0.08, 0.11, 0.15),
      maxWidth: pageWidth - margin * 2,
    });
    y -= lineHeight;
  }

  return pdf.save();
}

