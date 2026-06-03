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

test("muestra el % del valor del contrato y el prompt de cuenta cuando hay datos", () => {
  // Canon 1.000.000 × 12 = 12.000.000; Plus 49.900 → 0,42%.
  const out = applyFreeTierWatermark("<p>contrato</p>", {
    totalContractCop: 12_000_000,
    plusPriceCop: 49_900,
    promptAccount: true,
  });
  assert.ok(out.includes("menos del 0,42%"));
  assert.ok(out.includes("$12.000.000"));
  assert.ok(out.includes("crea tu cuenta"));
});

test("sin datos financieros usa copy genérico y omite el prompt de cuenta", () => {
  const out = applyFreeTierWatermark("<p>contrato</p>");
  assert.ok(out.includes("una pequeña fracción"));
  assert.ok(!out.includes("crea tu cuenta"));
});
