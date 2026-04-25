import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: true, contract: null, version: null });
    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!contractSnap.exists) return NextResponse.json({ success: true, contract: null, version: null });
    const contract = contractSnap.data() as { currentVersionId?: string } | undefined;
    if (!contract?.currentVersionId) return NextResponse.json({ success: true, contract: contractSnap.data(), version: null });
    const versionSnap = await firestore.collection("contract_versions").doc(contract.currentVersionId).get();
    return NextResponse.json({ success: true, contract: contractSnap.data(), version: versionSnap.data() ?? null });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo consultar la versión actual." }] }, { status: 500 });
  }
}

