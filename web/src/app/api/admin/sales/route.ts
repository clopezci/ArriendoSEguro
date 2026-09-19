import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { listSales, syncSalesLedger } from "@/lib/sales/salesLedger";

export const runtime = "nodejs";

function serverError(status = 500) {
  return NextResponse.json({ success: false, errors: [{ field: "server", message: "Error del servidor." }] }, { status });
}

/** GET /api/admin/sales — lista el libro de ventas interno. */
export async function GET(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return serverError(503);
  try {
    const sales = await listSales(firestore);
    const totalCop = sales.reduce((s, r) => s + (r.amountCop || 0), 0);
    return NextResponse.json({ success: true, sales, totalCop });
  } catch {
    return serverError();
  }
}

/** POST /api/admin/sales — sincroniza el libro con el histórico de pagos aprobados (Wompi). */
export async function POST(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return serverError(503);
  try {
    const result = await syncSalesLedger(firestore);
    return NextResponse.json({ success: true, ...result });
  } catch {
    return serverError();
  }
}
