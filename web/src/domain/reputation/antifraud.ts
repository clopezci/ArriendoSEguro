/**
 * Señales anti-fraude de reputación (flag-only, sin bloqueo automático
 * agresivo). Módulo **puro**: recibe metadatos de reseñas y devuelve señales
 * para revisión humana en el admin.
 *
 * Importante: la calificación **mutua** entre las dos partes de un contrato es
 * LEGÍTIMA (el modelo es bidireccional). El fraude se busca en patrones: el
 * mismo par de personas calificándose en **varios contratos** (posible
 * colusión para inflar reputación) o **ráfagas** de calificaciones del mismo
 * emisor en poco tiempo.
 */

export interface ReviewMeta {
  raterUid: string;
  subjectEmail: string;
  contractId: string;
  createdAt: string;
}

export type FraudSeverity = "low" | "medium" | "high";

export interface FraudSignal {
  code: "reciprocal_pair_multi" | "rater_burst";
  severity: FraudSeverity;
  detail: string;
}

/** Umbrales (ajustables). */
export const RECIPROCAL_PAIR_CONTRACT_THRESHOLD = 2; // mismo par en >=2 contratos
export const BURST_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
export const BURST_COUNT_THRESHOLD = 5; // >=5 reseñas del mismo emisor en la ventana

function parseTime(iso: string): number {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : 0;
}

/**
 * @param next         reseña nueva (ya validada como participante real)
 * @param subjectPair  reseñas existentes ENTRE el mismo par (rater↔subject), en ambos sentidos
 * @param raterRecent  reseñas recientes emitidas por el mismo rater (para ráfagas)
 */
export function detectFraudSignals(
  next: ReviewMeta,
  subjectPair: { contractId: string }[],
  raterRecent: { createdAt: string }[],
): FraudSignal[] {
  const signals: FraudSignal[] = [];

  // 1) Mismo par en múltiples contratos distintos.
  const distinctContracts = new Set<string>([next.contractId, ...subjectPair.map((r) => r.contractId)]);
  if (distinctContracts.size >= RECIPROCAL_PAIR_CONTRACT_THRESHOLD) {
    signals.push({
      code: "reciprocal_pair_multi",
      severity: distinctContracts.size >= 3 ? "high" : "medium",
      detail: `El mismo par de personas se ha calificado en ${distinctContracts.size} contratos distintos.`,
    });
  }

  // 2) Ráfaga: muchas reseñas del mismo emisor en poco tiempo.
  const nextT = parseTime(next.createdAt);
  const within = raterRecent.filter((r) => Math.abs(nextT - parseTime(r.createdAt)) <= BURST_WINDOW_MS);
  if (within.length + 1 >= BURST_COUNT_THRESHOLD) {
    signals.push({
      code: "rater_burst",
      severity: "medium",
      detail: `El emisor registró ${within.length + 1} calificaciones en menos de ${Math.round(BURST_WINDOW_MS / 60000)} minutos.`,
    });
  }

  return signals;
}

export function maxSeverity(signals: FraudSignal[]): FraudSeverity | null {
  if (signals.some((s) => s.severity === "high")) return "high";
  if (signals.some((s) => s.severity === "medium")) return "medium";
  if (signals.some((s) => s.severity === "low")) return "low";
  return null;
}
