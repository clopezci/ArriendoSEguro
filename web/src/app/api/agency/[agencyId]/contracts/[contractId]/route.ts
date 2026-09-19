import { NextResponse } from "next/server";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { CONTRACTS_COLLECTION, CONTRACT_VERSIONS_COLLECTION } from "@/lib/agencies/agencyContracts";

export const runtime = "nodejs";

/**
 * GET /api/agency/[agencyId]/contracts/[contractId] — devuelve el HTML de la
 * versión actual de un contrato de la agencia (para verlo). Verifica que el
 * contrato pertenezca a esta agencia.
 */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string; contractId: string }> }) {
  const { agencyId, contractId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const { firestore } = gate;

  const snap = await firestore.collection(CONTRACTS_COLLECTION).doc(contractId).get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : null;
  if (!data || data.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
  }
  const versionId = (data.currentVersionId as string) ?? "";
  if (!versionId) {
    return NextResponse.json({ success: false, errors: [{ field: "version", message: "Sin versión." }] }, { status: 404 });
  }
  const vSnap = await firestore.collection(CONTRACT_VERSIONS_COLLECTION).doc(versionId).get();
  const v = vSnap.exists ? (vSnap.data() as Record<string, unknown>) : null;
  if (!v) {
    return NextResponse.json({ success: false, errors: [{ field: "version", message: "Versión no encontrada." }] }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    html: (v.html as string) ?? "",
    tenantName: (data.tenantName as string) ?? "",
    propertyLabel: (data.propertyLabel as string) ?? "",
    agencyStatus: (data.agencyStatus as string) ?? "draft",
  });
}
