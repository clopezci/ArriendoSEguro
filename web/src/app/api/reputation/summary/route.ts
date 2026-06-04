import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { aggregateReviews } from "@/domain/reputation/aggregate";

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
  const agg = aggregateReviews(reviews);

  return NextResponse.json({
    success: true,
    totalReviews: agg.totalReviews,
    overallAverage: agg.overallAverage,
    summary: agg.byDirection,
  });
}
