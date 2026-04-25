import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * Endpoint de descarga local para PDF cuando no se usa bucket.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ contractVersionId: string }> },
) {
  try {
    const { contractVersionId } = await context.params;
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, message: "Firestore no configurado." }, { status: 503 });
    }

    const versionSnap = await firestore.collection("contract_versions").doc(contractVersionId).get();
    if (!versionSnap.exists) {
      return NextResponse.json({ success: false, message: "Versión no encontrada." }, { status: 404 });
    }
    const data = versionSnap.data() as { pdfStoragePath?: string; pdfUrl?: string } | undefined;
    if (!data?.pdfStoragePath) {
      return NextResponse.json({ success: false, message: "PDF no generado." }, { status: 404 });
    }
    if (data.pdfStoragePath.startsWith("gs://") && data.pdfUrl) {
      return NextResponse.redirect(data.pdfUrl, 302);
    }

    const file = await readFile(data.pdfStoragePath);
    return new NextResponse(file, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="contrato-${contractVersionId}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "No se pudo descargar el PDF." }, { status: 500 });
  }
}

