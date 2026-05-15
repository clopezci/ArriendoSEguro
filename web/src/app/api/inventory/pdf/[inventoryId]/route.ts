import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
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
    const inv = invSnap.data() as { pdfStoragePath?: string } | undefined;
    if (!inv?.pdfStoragePath) {
      return NextResponse.json({ success: false, message: "PDF no generado." }, { status: 404 });
    }
    const file = await readFile(inv.pdfStoragePath);
    auditEvent("inventory_pdf_downloaded", { inventoryId });
    return new NextResponse(file, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="inventario-${inventoryId}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "No se pudo descargar el PDF." },
      { status: 500 },
    );
  }
}

