import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

// Ver nota de seguridad en inventory/pdf/[inventoryId]: descarga por enlace, id
// aleatorio, ruta desde Firestore; protegida por la aleatoriedad del id.
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
    const inv = invSnap.data() as { deliveryActPdfStoragePath?: string } | undefined;
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

