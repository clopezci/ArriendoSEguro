import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ipcNoticeText,
  ipcStatus,
  isPlausibleIpc,
  isPlausibleUvt,
  resolveAnnualTokens,
  uvtNoticeText,
  uvtStatus,
  type AnnualValues,
} from "./annualValues";
import { parseDaneIpcReadings, pickDecemberIpc } from "./daneIpc";

const values: AnnualValues = {
  ipc: { percent: 5.1, year: 2025, appliesTo: 2026, source: "DANE", sourceUrl: "https://www.dane.gov.co/x", updatedAt: "2026-01-09T15:00:00.000Z", updatedBy: "auto (DANE)" },
  uvt: { value: 52374, year: 2026, source: "DIAN", sourceUrl: "https://www.dian.gov.co/", updatedAt: null, updatedBy: null },
};
const oct2026 = new Date("2026-10-09T12:00:00Z");
const jan2027 = new Date("2027-01-05T12:00:00Z");

test("estado: vigente durante el año al que aplica, pendiente al cambiar de año", () => {
  assert.equal(ipcStatus(values.ipc, oct2026), "updated");
  assert.equal(ipcStatus(values.ipc, jan2027), "pending");
  assert.equal(uvtStatus(values.uvt, oct2026), "updated");
  assert.equal(uvtStatus(values.uvt, jan2027), "pending");
});

test("el año se toma en hora de Colombia (31-dic 22:00 Bogotá sigue siendo el año viejo)", () => {
  // 2027-01-01T03:00Z = 2026-12-31 22:00 en Bogotá
  assert.equal(ipcStatus(values.ipc, new Date("2027-01-01T03:00:00Z")), "updated");
});

test("avisos: 'actualizado según' vs 'aún sin actualizar según' la fuente", () => {
  const ok = ipcNoticeText(values.ipc, oct2026);
  assert.match(ok, /Dato vigente para 2026: IPC 2025 = 5,10 %/);
  assert.match(ok, /= 5,10 % según DANE \(actualizado el 9 de enero de 2026\)\.$/);
  assert.equal(ipcNoticeText({ ...values.ipc, updatedAt: null }, oct2026), "Dato vigente para 2026: IPC 2025 = 5,10 % según DANE.");
  const pending = ipcNoticeText(values.ipc, jan2027);
  assert.match(pending, /Aún sin actualizar para 2027: DANE todavía no publica el IPC de 2026/);
  assert.match(pending, /IPC 2025 = 5,10 %/);
  assert.match(uvtNoticeText(values.uvt, jan2027), /Aún sin actualizar para 2027: DIAN/);
});

test("variables: cifras, cálculos de ejemplo y variables desconocidas visibles", () => {
  assert.equal(resolveAnnualTokens("IPC {ipc.year} = {ipc.percent} % en {ipc.appliesTo}", values), "IPC 2025 = 5,10 % en 2026");
  assert.equal(resolveAnnualTokens("{ipc.raise:1000000} → {ipc.newRent:1000000}", values), "$51.000 → $1.051.000");
  assert.equal(resolveAnnualTokens("{ipc.newRent:1500000}", values), "$1.576.500");
  assert.equal(resolveAnnualTokens("{uvt.value} ({uvt.year})", values), "$52.374 (2026)");
  assert.equal(resolveAnnualTokens("{ipc.nope} {smmlv.value}", values), "{ipc.nope} {smmlv.value}");
});

test("cordura de cifras externas", () => {
  assert.ok(isPlausibleIpc(5.1));
  assert.ok(!isPlausibleIpc(510));
  assert.ok(!isPlausibleIpc(NaN));
  assert.ok(isPlausibleUvt(55000, 52374));
  assert.ok(!isPlausibleUvt(5237, 52374));
  assert.ok(!isPlausibleUvt(90000, 52374));
});

// Fragmentos reales de la página técnica del IPC del DANE (formato vigente).
const DANE_SEPT = `<div><p>En septiembre de 2026 la variación mensual del IPC fue 0,37%, la variación año corrido fue 5,74% y la anual 6,29%.</p>
<p>En septiembre de 2026 la variación anual del IPC fue 6,29%, es decir, 1,11 puntos porcentuales mayor que la reportada en el mismo periodo del año anterior, cuando fue de 5,18%.</p></div>`;
const DANE_DEC = `<p>En <strong>diciembre de 2026</strong> la variaci&oacute;n mensual del IPC fue 0,40%, la variaci&oacute;n a&ntilde;o corrido fue 6,02% y la anual 6,02%.</p>
<p>En diciembre de 2026 la variación anual del IPC fue 6,02%, es decir…</p>`;

test("DANE: lee mes, año y variación anual de las dos frases del boletín", () => {
  const r = parseDaneIpcReadings(DANE_SEPT);
  assert.deepEqual(r, [{ month: 9, year: 2026, annualPercent: 6.29 }]);
});

test("DANE: solo acepta DICIEMBRE del año pedido", () => {
  assert.equal(pickDecemberIpc(DANE_SEPT, 2026), null); // aún no es diciembre
  assert.equal(pickDecemberIpc(DANE_DEC, 2025), null); // año equivocado
  assert.equal(pickDecemberIpc(DANE_DEC, 2026), 6.02);
});

test("DANE: cifras contradictorias para el mismo mes → no se publica nada", () => {
  const bad = `<p>En diciembre de 2026 la variación anual del IPC fue 6,02%.</p><p>En diciembre de 2026 la variación anual del IPC fue 7,50%.</p>`;
  assert.equal(pickDecemberIpc(bad, 2026), null);
});

test("DANE: página sin la frase (cambió el formato) → null, no rompe", () => {
  assert.equal(pickDecemberIpc("<html><body>Mantenimiento</body></html>", 2026), null);
});
