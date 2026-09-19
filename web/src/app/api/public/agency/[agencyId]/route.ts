import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAgency } from "@/lib/agencies/agencyStore";
import { isIdentityEnabledForAgency } from "@/domain/agencies/types";

export const runtime = "nodejs";

/** GET /api/public/agency/[agencyId] — nombre público de la agencia (para la página de auto-diligenciamiento). */
export async function GET(_request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false }, { status: 503 });
  const agency = await getAgency(firestore, agencyId);
  if (!agency || agency.status !== "active") {
    return NextResponse.json({ success: false }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    name: agency.name,
    logoUrl: agency.logoUrl ?? null,
    identityEnabled: isIdentityEnabledForAgency(agency),
    intakeFields: agency.intakeFields ?? [],
    studyEnabled: (agency.studyRules ?? []).length > 0,
  });
}
