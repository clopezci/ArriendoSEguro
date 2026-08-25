import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { ga4Diagnostics } from "@/lib/observability/ga4";

/** Diagnóstico en vivo de la conexión con GA4 (solo admin interno). */
export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const diag = await ga4Diagnostics();
  return NextResponse.json({ success: true, diag });
}
