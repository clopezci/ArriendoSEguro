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
    if (!firestore) return NextResponse.json({ success: true, inventory: null });
    const gate = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!gate.ok) return gate.response;
    const snap = await firestore
      .collection("inventories")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .where("inventoryType", "==", "initial")
      .limit(1)
      .get();
    if (snap.empty) return NextResponse.json({ success: true, inventory: null });
    return NextResponse.json({ success: true, inventory: snap.docs[0]?.data() ?? null });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo consultar inventario." }] }, { status: 500 });
  }
}

