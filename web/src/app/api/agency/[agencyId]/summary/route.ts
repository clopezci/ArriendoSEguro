import { NextResponse } from "next/server";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getCredits, listLandlords, listProperties } from "@/lib/agencies/agencyStore";

export const runtime = "nodejs";

/** GET /api/agency/[agencyId]/summary — datos de la agencia + saldo + conteos. */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const { firestore, agency } = gate;

  try {
    const [credits, landlords, properties] = await Promise.all([
      getCredits(firestore, agencyId),
      listLandlords(firestore, agencyId),
      listProperties(firestore, agencyId),
    ]);
    return NextResponse.json({
      success: true,
      agency: {
        id: agency.id,
        name: agency.name,
        nit: agency.nit ?? null,
        contactEmail: agency.contactEmail,
        status: agency.status,
      },
      credits: credits.balance,
      counts: { landlords: landlords.length, properties: properties.length },
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Error del servidor." }] }, { status: 500 });
  }
}
