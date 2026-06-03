import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { REPUTATION_CRITERIA, type ReputationDirection } from "@/domain/reputation/criteria";

export const runtime = "nodejs";

const REVIEWS_COLLECTION = "reputation_reviews";

/**
 * Resumen agregado y **privado** de la reputación del usuario autenticado:
 * promedio de estrellas recibidas, por criterio y global, según el rol con el
 * que fue calificado. No expone quién calificó ni permite búsqueda por cédula.
 */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const email = auth.user.email.trim().toLowerCase();
  const snap = await firestore
    .collection(REVIEWS_COLLECTION)
    .where("subjectEmail", "==", email)
    .where("status", "==", "active")
    .get()
    .catch(() => null);

  const reviews = snap?.docs.map((d) => d.data() as Record<string, unknown>) ?? [];

  // Agrupar por la dirección con la que fui calificado (define mi rol evaluado).
  const byDirection: Record<string, { sums: Record<string, number>; counts: Record<string, number>; n: number; overallSum: number }> = {};
  for (const r of reviews) {
    const direction = String(r.direction ?? "");
    const ratings = (r.ratings as Record<string, number>) ?? {};
    const overall = Number(r.overall ?? 0);
    if (!byDirection[direction]) byDirection[direction] = { sums: {}, counts: {}, n: 0, overallSum: 0 };
    const bucket = byDirection[direction];
    bucket.n += 1;
    bucket.overallSum += overall;
    for (const [k, v] of Object.entries(ratings)) {
      bucket.sums[k] = (bucket.sums[k] ?? 0) + Number(v);
      bucket.counts[k] = (bucket.counts[k] ?? 0) + 1;
    }
  }

  const summary = Object.entries(byDirection).map(([direction, b]) => {
    const criteria = REPUTATION_CRITERIA[direction as ReputationDirection] ?? [];
    return {
      direction,
      reviewsCount: b.n,
      overallAverage: b.n ? Math.round((b.overallSum / b.n) * 100) / 100 : 0,
      perCriterion: criteria.map((c) => ({
        key: c.key,
        label: c.label,
        average: b.counts[c.key] ? Math.round((b.sums[c.key] / b.counts[c.key]) * 100) / 100 : 0,
      })),
    };
  });

  return NextResponse.json({ success: true, totalReviews: reviews.length, summary });
}
