import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultObservabilityConfig,
  resolveObservabilityConfig,
  shouldSendErrorAlert,
} from "./observabilityConfig";

test("default: habilitado, umbral mínimo 1", () => {
  const c = defaultObservabilityConfig();
  assert.equal(c.errorAlertEnabled, true);
  assert.equal(c.errorAlertThreshold, 1);
  assert.equal(c.errorAlertWindowMinutes, 60);
});

test("resolve sin documento usa el default", () => {
  assert.deepEqual(resolveObservabilityConfig(undefined), defaultObservabilityConfig());
});

test("resolve respeta valores válidos y descarta inválidos", () => {
  const c = resolveObservabilityConfig({ errorAlertThreshold: 5, errorAlertWindowMinutes: 1 /* inválido */ });
  assert.equal(c.errorAlertThreshold, 5);
  assert.equal(c.errorAlertWindowMinutes, 60); // cae al default porque 1 < min 5
});

test("no alerta por debajo del umbral", () => {
  const c = defaultObservabilityConfig();
  assert.equal(shouldSendErrorAlert(c, 0, Date.parse("2026-06-04T10:00:00Z")).send, false);
});

test("alerta al alcanzar el umbral", () => {
  const c = defaultObservabilityConfig();
  assert.equal(shouldSendErrorAlert(c, 1, Date.parse("2026-06-04T10:00:00Z")).send, true);
});

test("respeta el enfriamiento", () => {
  const c = { ...defaultObservabilityConfig(), lastAlertAt: "2026-06-04T09:30:00Z" };
  // 30 min después, con cooldown 180 → no envía
  assert.equal(shouldSendErrorAlert(c, 3, Date.parse("2026-06-04T10:00:00Z")).send, false);
  // 4 horas después → envía
  assert.equal(shouldSendErrorAlert(c, 3, Date.parse("2026-06-04T13:31:00Z")).send, true);
});

test("deshabilitado nunca envía", () => {
  const c = { ...defaultObservabilityConfig(), errorAlertEnabled: false };
  assert.equal(shouldSendErrorAlert(c, 99, Date.parse("2026-06-04T10:00:00Z")).send, false);
});
