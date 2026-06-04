import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { aggregateReviews } from "@/domain/reputation/aggregate";
import {
  detectFraudSignals,
  maxSeverity,
  type FraudSignal,
} from "@/domain/reputation/antifraud";

export const REVIEWS_COLLECTION = "reputation_reviews";
export const AGGREGATES_COLLECTION = "reputation_aggregates";
export const FLAGS_COLLECTION = "reputation_flags";

export function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

/** Clave estable y opaca del sujeto (no expone la cédula ni el correo en el id). */
export function subjectKeyFromEmail(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32);
}

/**
 * Recalcula y persiste el agregado **privado** del sujeto (promedios y conteos)
 * a partir de sus reseñas activas. Habilita la consulta con consentimiento sin
 * recorrer todas las reseñas en cada lectura.
 */
export async function recomputeAggregateForSubject(firestore: Firestore, subjectEmail: string): Promise<void> {
  const email = normalizeEmail(subjectEmail);
  if (!email) return;
  const snap = await firestore
    .collection(REVIEWS_COLLECTION)
    .where("subjectEmail", "==", email)
    .where("status", "==", "active")
    .get()
    .catch(() => null);
  const reviews = snap?.docs.map((d) => d.data() as Record<string, unknown>) ?? [];
  const agg = aggregateReviews(reviews);

  await firestore
    .collection(AGGREGATES_COLLECTION)
    .doc(subjectKeyFromEmail(email))
    .set(
      {
        subjectEmail: email,
        totalReviews: agg.totalReviews,
        overallAverage: agg.overallAverage,
        byDirection: agg.byDirection,
        updatedAt: new Date().toISOString(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

/**
 * Corre las heurísticas anti-fraude para una reseña recién creada y, si hay
 * señales, las persiste en `reputation_flags` para revisión humana en el admin.
 * No bloquea: solo marca.
 */
export async function runAntifraudOnSubmit(
  firestore: Firestore,
  params: { raterUid: string; raterEmail: string; subjectEmail: string; contractId: string; createdAt: string },
): Promise<FraudSignal[]> {
  const subjectEmail = normalizeEmail(params.subjectEmail);

  // Reseñas entre el mismo par (en ambos sentidos): el rater calificó a este sujeto
  // antes, o este sujeto calificó al rater.
  const [ratedBefore, recentByRater] = await Promise.all([
    firestore
      .collection(REVIEWS_COLLECTION)
      .where("raterUid", "==", params.raterUid)
      .where("subjectEmail", "==", subjectEmail)
      .get()
      .catch(() => null),
    firestore
      .collection(REVIEWS_COLLECTION)
      .where("raterUid", "==", params.raterUid)
      .get()
      .catch(() => null),
  ]);

  const subjectPair = (ratedBefore?.docs ?? [])
    .map((d) => d.data() as { contractId?: string })
    .filter((r) => r.contractId && r.contractId !== params.contractId)
    .map((r) => ({ contractId: String(r.contractId) }));

  const raterRecent = (recentByRater?.docs ?? []).map((d) => ({
    createdAt: String((d.data() as { createdAt?: string }).createdAt ?? ""),
  }));

  const signals = detectFraudSignals(
    {
      raterUid: params.raterUid,
      subjectEmail,
      contractId: params.contractId,
      createdAt: params.createdAt,
    },
    subjectPair,
    raterRecent,
  );

  const severity = maxSeverity(signals);
  if (signals.length > 0 && severity) {
    await firestore.collection(FLAGS_COLLECTION).add({
      raterUid: params.raterUid,
      raterEmail: normalizeEmail(params.raterEmail),
      subjectEmail,
      contractId: params.contractId,
      signals,
      severity,
      status: "open",
      createdAt: params.createdAt,
      createdAtServer: FieldValue.serverTimestamp(),
    });
  }

  return signals;
}
