import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { purgeOldVisitorHashes } from "@/lib/observability/pageviews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Limpieza diaria de los hashes efímeros del contador de visitas (solo sirven
 * para deduplicar dentro de su propio día). Los conteos agregados por día se
 * conservan. Protegido por CRON_SECRET (lo dispara el cron diario).
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const res = await purgeOldVisitorHashes(firestore, Date.now());
  return NextResponse.json({ success: true, ...res });
}
