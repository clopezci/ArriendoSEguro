import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

/** Lista los documentos de propiedad/poder activos de una versión del contrato. */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const url = new URL(request.url);
  const contractId = url.searchParams.get("contractId") ?? "";
  const contractVersionId = url.searchParams.get("contractVersionId") ?? "";
  if (!contractId || !contractVersionId) {
    return NextResponse.json({ success: false, errors: [{ field: "query", message: "Parámetros incompletos." }] }, { status: 422 });
  }

  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId });
  if (!participant.ok) return participant.response;

  const snap = await firestore
    .collection("contracts")
    .doc(contractId)
    .collection("property_documents")
    .where("contractVersionId", "==", contractVersionId)
    .where("voided", "==", false)
    .get()
    .catch(() => null);

  const documents = (snap?.docs ?? []).map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      docType: String(x.docType ?? "otro"),
      originalFilename: String(x.originalFilename ?? ""),
      storagePath: String(x.storagePath ?? ""),
      sizeBytes: Number(x.sizeBytes ?? 0),
      uploadedAt: String(x.uploadedAt ?? ""),
    };
  });
  return NextResponse.json({ success: true, documents });
}
