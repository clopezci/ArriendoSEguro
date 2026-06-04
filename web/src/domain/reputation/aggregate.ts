/**
 * Agregación de reputación **por persona** (promedio histórico cruzando varios
 * contratos), reutilizada por el resumen privado del titular y por la consulta
 * con consentimiento. Módulo **puro** (sin Node ni red).
 *
 * Privacidad: solo produce **agregados** (promedios y conteos). Nunca expone
 * quién calificó ni en qué contrato.
 */

import { REPUTATION_CRITERIA, type ReputationDirection } from "@/domain/reputation/criteria";

export interface ReviewLike {
  direction?: string;
  ratings?: Record<string, number>;
  overall?: number;
}

export interface DirectionAggregate {
  direction: ReputationDirection;
  reviewsCount: number;
  overallAverage: number;
  perCriterion: { key: string; label: string; average: number }[];
}

export interface ReputationAggregate {
  totalReviews: number;
  /** Promedio global combinando todas las direcciones (0 si no hay reseñas). */
  overallAverage: number;
  byDirection: DirectionAggregate[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function aggregateReviews(reviews: ReviewLike[]): ReputationAggregate {
  const byDirection: Record<
    string,
    { sums: Record<string, number>; counts: Record<string, number>; n: number; overallSum: number }
  > = {};
  let overallSumAll = 0;
  let nAll = 0;

  for (const r of reviews) {
    const direction = String(r.direction ?? "");
    if (!direction) continue;
    const ratings = r.ratings ?? {};
    const overall = Number(r.overall ?? 0);
    if (!byDirection[direction]) byDirection[direction] = { sums: {}, counts: {}, n: 0, overallSum: 0 };
    const bucket = byDirection[direction];
    bucket.n += 1;
    bucket.overallSum += overall;
    overallSumAll += overall;
    nAll += 1;
    for (const [k, v] of Object.entries(ratings)) {
      bucket.sums[k] = (bucket.sums[k] ?? 0) + Number(v);
      bucket.counts[k] = (bucket.counts[k] ?? 0) + 1;
    }
  }

  const directions = Object.entries(byDirection).map(([direction, b]) => {
    const criteria = REPUTATION_CRITERIA[direction as ReputationDirection] ?? [];
    return {
      direction: direction as ReputationDirection,
      reviewsCount: b.n,
      overallAverage: b.n ? round2(b.overallSum / b.n) : 0,
      perCriterion: criteria.map((c) => ({
        key: c.key,
        label: c.label,
        average: b.counts[c.key] ? round2(b.sums[c.key] / b.counts[c.key]) : 0,
      })),
    };
  });

  return {
    totalReviews: nAll,
    overallAverage: nAll ? round2(overallSumAll / nAll) : 0,
    byDirection: directions,
  };
}
