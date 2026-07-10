import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToBlocks, renderContractPdfFromHtml } from "./pdf";

const SAMPLE = `
  <style>.x{color:red}</style>
  <h1>Contrato de arrendamiento</h1>
  <p>Entre <strong>Carlos López</strong> (arrendador) y Catalina Tabares (arrendatario) se celebra&hellip;</p>
  <h2>Primera. Objeto</h2>
  <p>El inmueble ubicado en la Carrera 32 # 25-48 de Medellín.</p>
  <ul><li>Canon: $1.500.000</li><li>Depósito: no aplica</li></ul>
  <table><tr><th>Parte</th><th>Documento</th></tr><tr><td>Carlos López</td><td>CC 71217228</td></tr></table>
`;

test("htmlToBlocks: reconoce títulos, párrafos, viñetas y filas de tabla, en orden", () => {
  const b = htmlToBlocks(SAMPLE);
  const kinds = b.map((x) => x.kind);
  assert.ok(kinds.includes("H1"), "debe haber H1");
  assert.ok(kinds.includes("H2"), "debe haber H2");
  assert.ok(kinds.includes("LI"), "debe haber viñetas");
  assert.ok(kinds.includes("ROW"), "debe haber filas de tabla");
  // El primer bloque es el título principal.
  assert.equal(b[0].kind, "H1");
  assert.match(b[0].text, /Contrato de arrendamiento/);
  // La entidad &hellip; se decodifica.
  assert.ok(b.some((x) => x.text.includes("...")));
  // La fila de tabla une las celdas.
  assert.ok(b.some((x) => x.kind === "ROW" && x.text.includes("Carlos López") && x.text.includes("CC 71217228")));
});

test("renderContractPdfFromHtml: produce un PDF válido sin lanzar", async () => {
  const bytes = await renderContractPdfFromHtml({
    html: SAMPLE,
    contractId: "c1",
    contractVersionId: "v1",
    versionNumber: 1,
    documentHash: "abc123",
    generatedAt: "2026-07-08",
  });
  assert.ok(bytes.length > 800, "el PDF debe tener contenido");
  // Cabecera de archivo PDF.
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-");
});
