import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateReviews,
  recencyWeight,
  isReviewExpired,
  REPUTATION_RETENTION_YEARS,
  RECENCY_HALF_LIFE_DAYS,
  RECENCY_WEIGHT_FLOOR,
} from "./aggregate";
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

test("recencyWeight: hoy=1, vida media=0.5, muy antiguo→piso", () => {
  const now = Date.parse("2026-06-01T00:00:00.000Z");
  const day = 86_400_000;
  assert.equal(recencyWeight("2026-06-01T00:00:00.000Z", now), 1);
  const halfLife = new Date(now - RECENCY_HALF_LIFE_DAYS * day).toISOString();
  assert.ok(Math.abs(recencyWeight(halfLife, now) - 0.5) < 1e-9);
  const ancient = new Date(now - 5 * 365 * day).toISOString();
  assert.equal(recencyWeight(ancient, now), RECENCY_WEIGHT_FLOOR);
  // Sin fecha o fecha inválida → peso neutro 1 (compatibilidad).
  assert.equal(recencyWeight(undefined, now), 1);
  assert.equal(recencyWeight("no-es-fecha", now), 1);
  // Fecha futura (desfase de reloj) → no supera 1.
  assert.equal(recencyWeight("2027-01-01T00:00:00.000Z", now), 1);
});

test("aggregateReviews pondera la reseña reciente por encima de la antigua", () => {
  const now = Date.parse("2026-06-01T00:00:00.000Z");
  const day = 86_400_000;
  const reciente = new Date(now - 10 * day).toISOString(); // hace 10 días → peso ~1
  const antigua = new Date(now - 3 * 365 * day).toISOString(); // hace 3 años → piso 0.25
  const agg = aggregateReviews(
    [
      { direction: "landlord_to_tenant", overall: 5, ratings: { payment: 5 }, createdAt: reciente },
      { direction: "landlord_to_tenant", overall: 1, ratings: { payment: 1 }, createdAt: antigua },
    ],
    { nowMs: now },
  );
  // Promedio plano sería 3; ponderado debe acercarse mucho más al 5 reciente.
  assert.ok(agg.overallAverage > 4, `esperaba >4, fue ${agg.overallAverage}`);
  const payment = agg.byDirection[0]?.perCriterion.find((c) => c.key === "payment");
  assert.ok((payment?.average ?? 0) > 4, `esperaba criterio >4, fue ${payment?.average}`);
  // El conteo sigue siendo el número real de reseñas.
  assert.equal(agg.byDirection[0]?.reviewsCount, 2);
  assert.equal(agg.totalReviews, 2);
});

test("caducidad: reseña con más de 4 años ni caduca ni cuenta", () => {
  const now = Date.parse("2026-06-01T00:00:00.000Z");
  const day = 86_400_000;
  const vieja = new Date(now - (REPUTATION_RETENTION_YEARS + 1) * 365 * day).toISOString(); // 5 años
  const reciente = new Date(now - 30 * day).toISOString();
  assert.equal(isReviewExpired(vieja, now), true);
  assert.equal(isReviewExpired(reciente, now), false);
  assert.equal(isReviewExpired(undefined, now), false); // sin fecha: vigente (conservador)

  const agg = aggregateReviews(
    [
      { direction: "landlord_to_tenant", overall: 1, ratings: { payment: 1 }, createdAt: vieja }, // caducada
      { direction: "landlord_to_tenant", overall: 5, ratings: { payment: 5 }, createdAt: reciente },
    ],
    { nowMs: now },
  );
  // La caducada no cuenta: solo la reciente (5).
  assert.equal(agg.totalReviews, 1);
  assert.equal(agg.overallAverage, 5);
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
