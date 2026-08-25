import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditEvent } from "@/features/contracts/audit-server";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { verifyDownloadToken } from "@/lib/security/downloadToken";

export const runtime = "nodejs";

// Seguridad: la descarga por enlace `<a href>` no puede enviar cabecera de
// autorización, así que exigimos UN TOKEN FIRMADO en la URL (`?t=`), que no se
// puede falsificar sin el secreto de servidor y caduca; como alternativa, una
// petición autenticada de un PARTICIPANTE del contrato (fetch con sesión).
// En producción los PDFs se sirven por URL firmada de Storage; esto endurece el
// fallback local por si acaso.

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
    const inv = invSnap.data() as { pdfStoragePath?: string; contractId?: string; contractVersionId?: string } | undefined;
    // Autorización: token firmado en la URL, o participante autenticado.
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

