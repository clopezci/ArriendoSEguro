import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateReviews } from "./aggregate";
import {
  detectFraudSignals,
  maxSeverity,
  BURST_COUNT_THRESHOLD,
} from "./antifraud";

test("aggregateReviews combina varias reseñas por dirección y global", () => {
  const agg = aggregateReviews([
    { direction: "landlord_to_tenant", overall: 5, ratings: { payment: 5, property_care: 5 } },
    { direction: "landlord_to_tenant", overall: 3, ratings: { payment: 4, property_care: 2 } },
    { direction: "tenant_to_landlord", overall: 4, ratings: { maintenance: 4 } },
  ]);
  assert.equal(agg.totalReviews, 3);
  assert.equal(agg.overallAverage, 4); // (5+3+4)/3
  const ltt = agg.byDirection.find((d) => d.direction === "landlord_to_tenant");
  assert.equal(ltt?.reviewsCount, 2);
  assert.equal(ltt?.overallAverage, 4); // (5+3)/2
  const payment = ltt?.perCriterion.find((c) => c.key === "payment");
  assert.equal(payment?.average, 4.5);
});

test("aggregateReviews vacío → ceros", () => {
  const agg = aggregateReviews([]);
  assert.equal(agg.totalReviews, 0);
  assert.equal(agg.overallAverage, 0);
  assert.deepEqual(agg.byDirection, []);
});

test("señal: mismo par en varios contratos", () => {
  const signals = detectFraudSignals(
    { raterUid: "u1", subjectEmail: "b@x.com", contractId: "c2", createdAt: "2026-06-04T00:00:00.000Z" },
    [{ contractId: "c1" }], // ya se calificaron en c1
    [],
  );
  assert.ok(signals.some((s) => s.code === "reciprocal_pair_multi"));
});

test("sin patrón sospechoso → sin señales", () => {
  const signals = detectFraudSignals(
    { raterUid: "u1", subjectEmail: "b@x.com", contractId: "c1", createdAt: "2026-06-04T00:00:00.000Z" },
    [],
    [],
  );
  assert.equal(signals.length, 0);
  assert.equal(maxSeverity(signals), null);
});

test("señal: ráfaga de calificaciones del mismo emisor", () => {
  const base = Date.parse("2026-06-04T00:00:00.000Z");
  const recent = Array.from({ length: BURST_COUNT_THRESHOLD - 1 }, (_, i) => ({
    createdAt: new Date(base + i * 1000).toISOString(),
  }));
  const signals = detectFraudSignals(
    { raterUid: "u1", subjectEmail: "b@x.com", contractId: "cN", createdAt: new Date(base).toISOString() },
    [],
    recent,
  );
  assert.ok(signals.some((s) => s.code === "rater_burst"));
  assert.equal(maxSeverity(signals), "medium");
});
