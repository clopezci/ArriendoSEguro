import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import {
  AGGREGATES_COLLECTION,
  normalizeEmail,
  subjectKeyFromEmail,
} from "@/lib/reputation/aggregate-store";
import { LOOKUP_CONSENTS_COLLECTION } from "@/lib/reputation/aggregate-store";

export const runtime = "nodejs";

/**
 * El solicitante consulta el resultado. Solo devuelve el **agregado** del
 * titular (promedio y número de contratos) si existe un consentimiento
 * **granted**. Nunca expone quién calificó ni el detalle por contrato.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  const subjectEmail = normalizeEmail(new URL(request.url).searchParams.get("subjectEmail") ?? "");
  if (!subjectEmail) {
    return NextResponse.json(
      { success: false, errors: [{ field: "subjectEmail", message: "Falta el correo del titular." }] },
      { status: 422 },
    );
  }

  const docId = `${auth.user.uid}__${subjectKeyFromEmail(subjectEmail)}`;
  const consentSnap = await firestore.collection(LOOKUP_CONSENTS_COLLECTION).doc(docId).get();
  const status = consentSnap.exists ? (consentSnap.data() as { status?: string }).status ?? "none" : "none";

  if (status !== "granted") {
    return NextResponse.json({ success: true, status });
  }

  const aggSnap = await firestore.collection(AGGREGATES_COLLECTION).doc(subjectKeyFromEmail(subjectEmail)).get();
  if (!aggSnap.exists) {
    return NextResponse.json({
      success: true,
      status: "granted",
      aggregate: { totalReviews: 0, overallAverage: 0, byDirection: [] },
    });
  }
  const a = aggSnap.data() as Record<string, unknown>;
  return NextResponse.json({
    success: true,
    status: "granted",
    aggregate: {
      totalReviews: Number(a.totalReviews ?? 0),
      overallAverage: Number(a.overallAverage ?? 0),
      byDirection: (a.byDirection as unknown[]) ?? [],
    },
  });
}
