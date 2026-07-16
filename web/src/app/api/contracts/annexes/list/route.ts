import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    const contractVersionId = url.searchParams.get("contractVersionId") ?? "";
    if (!contractId || !contractVersionId) {
      return NextResponse.json({ success: false, errors: [{ field: "query", message: "contractId y contractVersionId son obligatorios." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: true, annexes: [] });
    const gate = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!gate.ok) return gate.response;
    const snap = await firestore
      .collection("contract_annexes")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .get();
    return NextResponse.json({ success: true, annexes: snap.docs.map((d) => d.data()) });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudieron consultar anexos." }] }, { status: 500 });
  }
}

