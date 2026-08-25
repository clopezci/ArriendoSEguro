import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { verifyDownloadToken } from "@/lib/security/downloadToken";

export const runtime = "nodejs";

// Seguridad (igual que inventory/pdf): descarga por enlace → exige token firmado
// en la URL (`?t=`) o petición autenticada de un participante del contrato.
export async function GET(
  request: Request,
  context: { params: Promise<{ inventoryId: string }> },
) {
  try {
    const { inventoryId } = await context.params;
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { success: false, message: "Firestore no configurado." },
        { status: 503 },
      );
    }
    const invSnap = await firestore.collection("inventories").doc(inventoryId).get();
    if (!invSnap.exists) {
      return NextResponse.json(
        { success: false, message: "Inventario no encontrado." },
        { status: 404 },
      );
    }
    const inv = invSnap.data() as { deliveryActPdfStoragePath?: string; contractId?: string; contractVersionId?: string } | undefined;
    const token = new URL(request.url).searchParams.get("t");
    if (!verifyDownloadToken(inventoryId, token)) {
      const contractId = String(inv?.contractId ?? "");
      const cvid = String(inv?.contractVersionId ?? "");
      const participant = contractId && cvid
        ? await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: cvid })
        : null;
      if (!participant || !participant.ok) {
        return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
      }
    }
    if (!inv?.deliveryActPdfStoragePath) {
      return NextResponse.json({ success: false, message: "PDF de acta no generado." }, { status: 404 });
    }
    const file = await readFile(inv.deliveryActPdfStoragePath);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="acta-entrega-${inventoryId}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "No se pudo descargar el PDF del acta." },
      { status: 500 },
    );
  }
}

