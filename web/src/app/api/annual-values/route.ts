import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAnnualValuesView } from "@/lib/annual/annualValuesServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Valores anuales vigentes (IPC, UVT) con su estado y el aviso visible. Público
 * (son datos oficiales); lo usan las pantallas de renovación y revisión del
 * contrato para no depender de una cifra fija en el código.
 */
export async function GET() {
  const view = await getAnnualValuesView(getAdminFirestore());
  return NextResponse.json(
    { success: true, ...view },
    { headers: { "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
