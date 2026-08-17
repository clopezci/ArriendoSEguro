/**
 * Agregación de reputación **por persona** (promedio cruzando varios contratos),
 * reutilizada por el resumen privado del titular y por la consulta con
 * consentimiento. Módulo **puro** (sin Node ni red).
 *
 * Ponderación por recencia: las reseñas recientes pesan más que las antiguas
 * (vida media configurable). En Colombia la situación de una persona cambia
 * rápido; premiar la mejora reciente incentiva a mantenerse al día. Si una
 * reseña no trae fecha, se le da peso neutro (1) para no romper compatibilidad.
 *
 * Privacidad: solo produce **agregados** (promedios y conteos). Nunca expone
 * quién calificó ni en qué contrato.
 */

import { REPUTATION_CRITERIA, type ReputationDirection } from "@/domain/reputation/criteria";

export interface ReviewLike {
  direction?: string;
  ratings?: Record<string, number>;
  overall?: number;
  /** Fecha ISO de creación de la reseña; base para la ponderación por recencia. */
  createdAt?: string;
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

/**
 * Vida media de la ponderación: una reseña de hace `RECENCY_HALF_LIFE_DAYS` días
 * pesa la mitad que una de hoy. Con piso `RECENCY_WEIGHT_FLOOR` para que el
 * histórico antiguo nunca deje de aportar señal (no se "borra" el pasado).
 */
export const RECENCY_HALF_LIFE_DAYS = 180;
export const RECENCY_WEIGHT_FLOOR = 0.25;
const DAY_MS = 86_400_000;

/**
 * Caducidad del dato de reputación: las calificaciones con más de estos años
 * **dejan de contar** y se **borran** por un cron. Alinea con el principio de
 * temporalidad (Ley 1581 de 2012) y con el período de custodia del expediente
 * (5 años). NOTA LEGAL: el dato NEGATIVO puede tener un tope de permanencia
 * menor (~4 años, Ley 1266 de 2008) si se considera dato financiero/comercial;
 * pendiente sign-off del abogado (si aplica, bajar a 4 para calificaciones bajas).
 */
export const REPUTATION_RETENTION_YEARS = 5;

/** Instante (ms) antes del cual una reseña ya caducó. */
export function retentionCutoffMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setFullYear(d.getFullYear() - REPUTATION_RETENTION_YEARS);
  return d.getTime();
}

/** ¿La reseña ya caducó? Sin fecha válida se considera vigente (conservador). */
export function isReviewExpired(createdAt: string | undefined, nowMs: number): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return t < retentionCutoffMs(nowMs);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Peso de una reseña según su antigüedad (1 = hoy, decae a la mitad cada vida media). */
export function recencyWeight(createdAt: string | undefined, nowMs: number): number {
  if (!createdAt) return 1;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return 1;
  const ageDays = Math.max(0, (nowMs - t) / DAY_MS);
  const w = Math.pow(2, -ageDays / RECENCY_HALF_LIFE_DAYS);
  return Math.max(RECENCY_WEIGHT_FLOOR, w);
}

export function aggregateReviews(
  reviews: ReviewLike[],
  opts?: { nowMs?: number },
): ReputationAggregate {
  const nowMs = opts?.nowMs ?? Date.now();
  const byDirection: Record<
    string,
    {
      sums: Record<string, number>;
      weightW: Record<string, number>;
      n: number;
      overallSum: number;
      overallW: number;
    }
  > = {};
  let overallSumAll = 0;
  let overallWAll = 0;
  let nAll = 0;

  for (const r of reviews) {
    const direction = String(r.direction ?? "");
    if (!direction) continue;
    // Caducidad: las reseñas vencidas no cuentan (aunque el cron aún no las borre).
    if (isReviewExpired(r.createdAt, nowMs)) continue;
    const ratings = r.ratings ?? {};
    const overall = Number(r.overall ?? 0);
    const w = recencyWeight(r.createdAt, nowMs);
    if (!byDirection[direction]) {
      byDirection[direction] = { sums: {}, weightW: {}, n: 0, overallSum: 0, overallW: 0 };
    }
    const bucket = byDirection[direction];
    bucket.n += 1;
    bucket.overallSum += overall * w;
    bucket.overallW += w;
    overallSumAll += overall * w;
    overallWAll += w;
    nAll += 1;
    for (const [k, v] of Object.entries(ratings)) {
      bucket.sums[k] = (bucket.sums[k] ?? 0) + Number(v) * w;
      bucket.weightW[k] = (bucket.weightW[k] ?? 0) + w;
    }
  }

  const directions = Object.entries(byDirection).map(([direction, b]) => {
    const criteria = REPUTATION_CRITERIA[direction as ReputationDirection] ?? [];
    return {
      direction: direction as ReputationDirection,
      reviewsCount: b.n,
      overallAverage: b.overallW ? round2(b.overallSum / b.overallW) : 0,
      perCriterion: criteria.map((c) => ({
        key: c.key,
        label: c.label,
        average: b.weightW[c.key] ? round2(b.sums[c.key] / b.weightW[c.key]) : 0,
      })),
    };
  });

  return {
    totalReviews: nAll,
    overallAverage: overallWAll ? round2(overallSumAll / overallWAll) : 0,
    byDirection: directions,
  };
}
