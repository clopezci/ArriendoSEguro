import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFreeTierWatermark, FREE_TIER_WATERMARK_TEXT } from "./freeTierWatermark";

test("applyFreeTierWatermark conserva el contrato y añade marca + CTA", () => {
  const original = "<h1>CONTRATO DE ARRENDAMIENTO</h1><p>cláusulas…</p>";
  const out = applyFreeTierWatermark(original);
  // El contrato original sigue presente (es usable).
  assert.ok(out.includes(original));
  // Marca de agua discreta.
  assert.ok(out.includes(FREE_TIER_WATERMARK_TEXT));
  // CTA enganchador que crea necesidad.
  assert.ok(out.includes("Te falta el respaldo"));
  assert.ok(out.toLowerCase().includes("arriendoseguro.app"));
  // No invalida el documento (no dice "SIN VALIDEZ" como el demo).
  assert.ok(!out.includes("SIN VALIDEZ"));
});
