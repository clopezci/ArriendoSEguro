import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  getAnnualRefreshMeta,
  getAnnualValuesView,
  runAnnualValuesRefresh,
} from "@/lib/annual/annualValuesServer";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
}

/** Estado de los valores anuales + última revisión automática (solo admin). */
export async function GET(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return unavailable();
  const [view, meta] = await Promise.all([getAnnualValuesView(firestore), getAnnualRefreshMeta(firestore)]);
  return NextResponse.json({ success: true, ...view, meta });
}

/** "Revisar ahora": corre la revisión de inmediato (ignora la ventana ene–feb). */
export async function POST(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return unavailable();
  const result = await runAnnualValuesRefresh(firestore, { force: true });
  auditEvent("annual_values_manual_check", { byEmail: gate.user.email, ipcChanged: result.ipc?.changed ?? false });
  const [view, meta] = await Promise.all([getAnnualValuesView(firestore), getAnnualRefreshMeta(firestore)]);
  return NextResponse.json({ success: true, result, ...view, meta });
}
