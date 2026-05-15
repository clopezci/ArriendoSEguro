import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

function parseGsUri(gs: string): { bucket: string; objectPath: string } | null {
  if (!gs.startsWith("gs://")) return null;
  const rest = gs.slice(5);
  const i = rest.indexOf("/");
  if (i <= 0) return null;
  const bucket = rest.slice(0, i);
  const objectPath = rest.slice(i + 1);
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    const novedadId = url.searchParams.get("novedadId") ?? "";
    if (!contractId.trim() || !novedadId.trim()) {
      return NextResponse.json({ success: false, message: "Parámetros obligatorios." }, { status: 422 });
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, message: "Firestore no configurado." }, { status: 503 });
    }

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    const currentVersionId = (cSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId;
    if (!currentVersionId) {
      return NextResponse.json({ success: false, message: "Expediente sin versión actual." }, { status: 404 });
    }

    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId: currentVersionId,
    });
    if (!participant.ok) return participant.response;

    const novSnap = await firestore
      .collection("contracts")
      .doc(contractId)
      .collection("novedades")
      .doc(novedadId)
      .get();
    if (!novSnap.exists) {
      return NextResponse.json({ success: false, message: "Novedad no encontrada." }, { status: 404 });
    }
    const row = novSnap.data() as {
      attachmentStoragePath?: string;
      attachmentContentType?: string;
      attachmentOriginalName?: string;
    };
    const path = row?.attachmentStoragePath?.trim();
    const ct = row?.attachmentContentType?.trim() || "application/octet-stream";
    if (!path) {
      return NextResponse.json({ success: false, message: "Esta novedad no tiene archivo adjunto." }, { status: 404 });
    }

    const gs = parseGsUri(path);
    if (gs) {
      try {
        const bucket = getStorage().bucket(gs.bucket);
        const [buf] = await bucket.file(gs.objectPath).download();
        const name = (row.attachmentOriginalName ?? `adjunto-${novedadId}`).replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]+/g, "_").slice(0, 120);
        auditEvent("expediente_novedad_attachment_downloaded", {
          contractId,
          novedadId,
          role: participant.role,
        });
        return new NextResponse(new Uint8Array(buf), {
          status: 200,
          headers: {
            "content-type": ct,
            "content-disposition": `attachment; filename="${name}"`,
            "cache-control": "private, no-store",
          },
        });
      } catch {
        return NextResponse.json({ success: false, message: "No se pudo leer el archivo en Storage." }, { status: 502 });
      }
    }

    try {
      const file = await readFile(path);
      const name = (row.attachmentOriginalName ?? `adjunto-${novedadId}`).replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]+/g, "_").slice(0, 120);
      auditEvent("expediente_novedad_attachment_downloaded", {
        contractId,
        novedadId,
        role: participant.role,
        source: "local",
      });
      return new NextResponse(file, {
        status: 200,
        headers: {
          "content-type": ct,
          "content-disposition": `attachment; filename="${name}"`,
          "cache-control": "private, no-store",
        },
      });
    } catch {
      return NextResponse.json({ success: false, message: "No se pudo leer el archivo local." }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Error al servir el adjunto." }, { status: 500 });
  }
}
