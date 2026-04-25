import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    const contractVersionId = url.searchParams.get("contractVersionId") ?? "";
    if (!contractId || !contractVersionId) {
      return NextResponse.json(
        { success: false, errors: [{ field: "query", message: "contractId y contractVersionId son obligatorios." }] },
        { status: 422 },
      );
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: true, signatures: [] });

    const snap = await firestore
      .collection("signatures")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .get();

    const signatures = snap.docs.map((d) => {
      const s = d.data() as {
        partyType: string;
        signerName: string;
        signerEmail: string;
        signatureStatus: string;
        sentAt?: string;
        signedAt?: string;
      };
      return {
        id: d.id,
        partyType: s.partyType,
        signerName: s.signerName,
        signerEmail: s.signerEmail,
        signatureStatus: s.signatureStatus,
        sentAt: s.sentAt ?? null,
        signedAt: s.signedAt ?? null,
      };
    });
    return NextResponse.json({ success: true, signatures });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo listar firmas." }] },
      { status: 500 },
    );
  }
}

