import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import {
  NOTARIAL_SHARES_COLLECTION,
  isNotarialShareUsable,
  type NotarialShareDoc,
} from "@/domain/contracts/notarialShare";

export const runtime = "nodejs";

/**
 * Descarga del PDF del contrato. Requiere ser **parte del contrato** (el PDF
 * contiene datos personales). El cliente debe llamar con `Authorization`.
 */
export async function GET(
  request: Request,
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
    const data = versionSnap.data() as { pdfStoragePath?: string; pdfUrl?: string; contractId?: string } | undefined;

    // Autorización: (a) parte del contrato por sesión, o (b) enlace compartido
    // (token) que el dueño le pasó al inquilino, acotado a esta misma versión.
    const shareToken = new URL(request.url).searchParams.get("shareToken")?.trim() ?? "";
    if (shareToken) {
      const shareSnap = await firestore.collection(NOTARIAL_SHARES_COLLECTION).doc(shareToken).get();
      const share = shareSnap.exists ? (shareSnap.data() as NotarialShareDoc) : null;
      if (!share || !isNotarialShareUsable(share, Date.now()) || share.contractVersionId !== contractVersionId) {
        return NextResponse.json({ success: false, message: "El enlace no es válido o ya venció." }, { status: 403 });
      }
    } else {
      const participant = await requireContractParticipant(request, firestore, data?.contractId ?? "", {
        kind: "by_version",
        contractVersionId,
      });
      if (!participant.ok) return participant.response;
    }
    if (!data?.pdfStoragePath) {
      return NextResponse.json({ success: false, message: "PDF no generado." }, { status: 404 });
    }
    // Si está en Storage, descargamos los bytes a través de esta ruta autenticada
    // (no redirigimos a URL firmada: el cliente la pide con `Authorization` y un
    // redirect cross-origin perdería la cabecera y bloquearía la lectura por CORS).
    if (data.pdfStoragePath.startsWith("gs://")) {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
      if (!bucketName) {
        return NextResponse.json({ success: false, message: "Storage no configurado." }, { status: 503 });
      }
      const objectPath = data.pdfStoragePath.slice(`gs://${bucketName}/`.length);
      const [bytes] = await getStorage().bucket(bucketName).file(objectPath).download();
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="contrato-${contractVersionId}.pdf"`,
        },
      });
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

