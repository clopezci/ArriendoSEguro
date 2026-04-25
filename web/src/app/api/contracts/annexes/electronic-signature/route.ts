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
    if (!firestore) return NextResponse.json({ success: true, annex: null });
    const snap = await firestore
      .collection("contract_annexes")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .where("annexType", "==", "electronic_signature_evidence")
      .limit(1)
      .get();
    if (snap.empty) return NextResponse.json({ success: true, annex: null });
    const d = snap.docs[0]?.data() as {
      title?: string;
      htmlContent?: string;
      pdfUrl?: string;
      generatedAt?: string;
      documentHash?: string;
    };
    return NextResponse.json({
      success: true,
      annex: {
        title: d.title ?? "Evidencia de firma",
        htmlContent: d.htmlContent ?? "",
        pdfUrl: d.pdfUrl ?? null,
        generatedAt: d.generatedAt ?? null,
        documentHash: d.documentHash ?? null,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo cargar anexo de evidencia." }] },
      { status: 500 },
    );
  }
}

