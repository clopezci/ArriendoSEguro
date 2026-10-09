import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireCronAuth } from "@/lib/security/cron";
import { runAnnualValuesRefresh } from "@/lib/annual/annualValuesServer";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron (lo dispara /api/cron/daily): revisión SEMANAL de valores anuales
 * oficiales durante enero y febrero (IPC del DANE automático; UVT de la DIAN
 * con recordatorio). Fuera de esa ventana, o si ya corrió esta semana, no hace
 * nada. Protegido por CRON_SECRET.
 */
export async function POST(request: Request) {
  const gate = requireCronAuth(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  try {
    const result = await runAnnualValuesRefresh(firestore);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    await logServerError("annual-values/refresh", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Fallo la revisión de valores anuales." }] }, { status: 500 });
  }
}
