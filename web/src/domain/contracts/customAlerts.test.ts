import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCustomAlert, nextFireAfter, isAlertFrequency } from "./customAlerts";

test("validateCustomAlert exige nombre, mensaje, periodicidad y fecha válidos", () => {
  assert.equal(validateCustomAlert({ name: "Pago predial", message: "Pagar el impuesto predial", frequency: "yearly", startDate: "2026-03-01" }), null);
  assert.ok(validateCustomAlert({ name: "x", message: "ok mensaje", frequency: "daily", startDate: "2026-01-01" })); // nombre corto
  assert.ok(validateCustomAlert({ name: "Nombre", message: "m", frequency: "daily", startDate: "2026-01-01" })); // mensaje corto
  assert.ok(validateCustomAlert({ name: "Nombre", message: "mensaje", frequency: "cada rato", startDate: "2026-01-01" })); // periodicidad
  assert.ok(validateCustomAlert({ name: "Nombre", message: "mensaje", frequency: "daily", startDate: "no-fecha" })); // fecha
});

test("isAlertFrequency", () => {
  assert.equal(isAlertFrequency("monthly"), true);
  assert.equal(isAlertFrequency("cada mes"), false);
});

test("nextFireAfter avanza y salta fechas pasadas; once no se repite", () => {
  const now = new Date("2026-06-15T00:00:00.000Z");
  assert.equal(nextFireAfter(new Date("2026-01-01T00:00:00.000Z"), "once", now), null);
  // diaria desde una fecha pasada → primer día futuro
  const d = nextFireAfter(new Date("2026-06-14T00:00:00.000Z"), "daily", now)!;
  assert.ok(d.getTime() > now.getTime());
  // mensual desde marzo, con now en junio → julio (siguiente futuro)
  const m = nextFireAfter(new Date("2026-03-10T00:00:00.000Z"), "monthly", now)!;
  assert.equal(m.toISOString().slice(0, 7), "2026-07");
});
