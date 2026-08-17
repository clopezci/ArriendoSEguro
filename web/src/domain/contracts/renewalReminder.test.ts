import { test } from "node:test";
import assert from "node:assert/strict";
import { renewalReminderTargets, dueRenewalReminder, daysUntilEnd } from "./renewalReminder";

// Fin 2027-01-01 → deadline (3m antes) = 2026-10-01; r1 = 2026-09-17; r2 = 2026-09-24.
const END = "2027-01-01";

test("renewalReminderTargets calcula 3 meses, +2 y +1 semana antes", () => {
  const t = renewalReminderTargets(END);
  assert.ok(t);
  assert.equal(t!.deadline.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(t!.target1.toISOString().slice(0, 10), "2026-09-17");
  assert.equal(t!.target2.toISOString().slice(0, 10), "2026-09-24");
});

test("dueRenewalReminder respeta la ventana y lo ya enviado", () => {
  const before = new Date("2026-09-10T12:00:00Z");
  const atR1 = new Date("2026-09-17T12:00:00Z");
  const atR2 = new Date("2026-09-24T12:00:00Z");
  const afterDeadline = new Date("2026-10-15T12:00:00Z");
  const afterEnd = new Date("2027-02-01T12:00:00Z");

  assert.equal(dueRenewalReminder(END, before, {}), null);
  assert.equal(dueRenewalReminder(END, atR1, {}), "r1");
  assert.equal(dueRenewalReminder(END, atR2, { r1: true }), "r2");
  assert.equal(dueRenewalReminder(END, atR2, { r1: true, r2: true }), null);
  // Catch-up: pasado el preaviso pero aún vigente y sin ningún aviso → envía uno.
  assert.equal(dueRenewalReminder(END, afterDeadline, {}), "r1");
  // Si ya se avisó (aunque sea uno), no se repite el catch-up.
  assert.equal(dueRenewalReminder(END, afterDeadline, { r1: true }), null);
  // Pasado el fin del contrato, ya no hay aviso.
  assert.equal(dueRenewalReminder(END, afterEnd, {}), null);
});

test("daysUntilEnd devuelve días enteros no negativos", () => {
  assert.equal(daysUntilEnd(END, new Date("2026-12-02T00:00:00Z")), 30);
  assert.equal(daysUntilEnd(END, new Date("2027-06-01T00:00:00Z")), 0);
});

test("fechas inválidas no rompen", () => {
  assert.equal(renewalReminderTargets("no-es-fecha"), null);
  assert.equal(dueRenewalReminder("no-es-fecha", new Date("2026-09-17T00:00:00Z"), {}), null);
});
