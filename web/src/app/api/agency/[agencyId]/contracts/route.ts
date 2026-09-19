import { NextResponse } from "next/server";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { listAgencyContracts } from "@/lib/agencies/agencyContracts";

export const runtime = "nodejs";

/** GET /api/agency/[agencyId]/contracts — cartera (lista de contratos). */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const contracts = await listAgencyContracts(gate.firestore, agencyId);
  return NextResponse.json({ success: true, contracts });
}
