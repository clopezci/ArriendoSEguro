import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { purgeExpiredReviews } from "@/lib/reputation/aggregate-store";
import { purgeExpiredCertificates } from "@/lib/reputation/certificate-store";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron: **caducidad automática** de la reputación. Borra las calificaciones con
 * más de REPUTATION_RETENTION_YEARS (4) años, recalcula los agregados afectados
 * y limpia los certificados caducados. Lo dispara el despachador /api/cron/daily.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  try {
    const reviews = await purgeExpiredReviews(firestore);
    const certs = await purgeExpiredCertificates(firestore);
    auditEvent("reputation_retention_purged", {
      reviewsDeleted: reviews.deleted,
      subjectsRecomputed: reviews.subjectsRecomputed,
      certificatesDeleted: certs.deleted,
    });
    return NextResponse.json({ success: true, reviews, certificates: certs });
  } catch (err) {
    await logServerError("reputation/retention/purge", err);
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo ejecutar la caducidad." }] },
      { status: 500 },
    );
  }
}
