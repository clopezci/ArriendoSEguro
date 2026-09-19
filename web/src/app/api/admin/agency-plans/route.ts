import { NextResponse } from "next/server";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAgencyPlans, setAgencyPlans } from "@/domain/agencies/plans";

export const runtime = "nodejs";

/** GET /api/admin/agency-plans — catálogo de planes de crédito de agencias. */
export async function GET(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false }, { status: 503 });
  const plans = await getAgencyPlans(firestore);
  return NextResponse.json({ success: true, plans });
}

/** PUT /api/admin/agency-plans — reemplaza el catálogo ({ plans: [...] }). */
export async function PUT(request: Request) {
  const gate = await requireInternalAdmin(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const plans = await setAgencyPlans(firestore, (body as { plans?: unknown })?.plans);
  return NextResponse.json({ success: true, plans });
}
