import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getTaxConfig } from "@/lib/tax/serverTaxConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado tributario PÚBLICO (sin secretos): si la empresa es responsable de IVA
 * y la tarifa. Lo usan la UI (mostrar "+ IVA") y la nota legal dinámica del footer.
 */
export async function GET() {
  const firestore = getAdminFirestore();
  const tax = firestore ? await getTaxConfig(firestore) : null;
  return NextResponse.json({
    success: true,
    ivaResponsable: Boolean(tax?.ivaResponsable),
    ivaRate: tax?.ivaRate ?? 19,
    regime: tax?.regime ?? "no_responsable",
  });
}
