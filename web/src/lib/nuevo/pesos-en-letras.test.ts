import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroALetras, pesosEnLetras } from "./pesos-en-letras";

test("numeroALetras: casos base", () => {
  assert.equal(numeroALetras(0), "cero");
  assert.equal(numeroALetras(1), "uno");
  assert.equal(numeroALetras(15), "quince");
  assert.equal(numeroALetras(21), "veintiuno");
  assert.equal(numeroALetras(100), "cien");
  assert.equal(numeroALetras(101), "ciento uno");
  assert.equal(numeroALetras(215), "doscientos quince");
});

test("numeroALetras: miles y millones", () => {
  assert.equal(numeroALetras(1000), "mil");
  assert.equal(numeroALetras(1500), "mil quinientos");
  assert.equal(numeroALetras(2000), "dos mil");
  assert.equal(numeroALetras(1_000_000), "un millón");
  assert.equal(numeroALetras(1_500_000), "un millón quinientos mil");
  assert.equal(numeroALetras(2_500_000), "dos millones quinientos mil");
});

test("pesosEnLetras: sufijo legal y vacío para <=0", () => {
  assert.equal(pesosEnLetras(1_500_000), "un millón quinientos mil pesos m/cte");
  assert.equal(pesosEnLetras(0), "");
});
