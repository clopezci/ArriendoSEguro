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
    const annexId = url.searchParams.get("annexId") ?? "";
    if (!annexId.trim()) {
      return NextResponse.json({ success: false, message: "annexId obligatorio." }, { status: 422 });
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, message: "Firestore no configurado." }, { status: 503 });
    }

    const snap = await firestore.collection("contract_annexes").doc(annexId).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, message: "Anexo no encontrado." }, { status: 404 });
    }

    const row = snap.data() as { contractId?: string; contractVersionId?: string; pdfStoragePath?: string } | undefined;
    const contractId = row?.contractId;
    const contractVersionId = row?.contractVersionId;
    const pdfStoragePath = row?.pdfStoragePath?.trim();
    if (!contractId || !contractVersionId || !pdfStoragePath) {
      return NextResponse.json({ success: false, message: "PDF no disponible para este anexo." }, { status: 404 });
    }

    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!participant.ok) return participant.response;

    const gs = parseGsUri(pdfStoragePath);
    if (gs) {
      try {
        const bucket = getStorage().bucket(gs.bucket);
        const [buf] = await bucket.file(gs.objectPath).download();
        auditEvent("contract_annex_pdf_downloaded", { annexId, contractId, source: "storage" });
        return new NextResponse(new Uint8Array(buf), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `attachment; filename="anexo-${annexId.slice(-24)}.pdf"`,
            "cache-control": "private, no-store",
          },
        });
      } catch {
        return NextResponse.json({ success: false, message: "No se pudo leer el PDF en Storage." }, { status: 502 });
      }
    }

    try {
      const file = await readFile(pdfStoragePath);
      auditEvent("contract_annex_pdf_downloaded", { annexId, contractId, source: "local" });
      return new NextResponse(file, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="anexo-${annexId.slice(-24)}.pdf"`,
          "cache-control": "private, no-store",
        },
      });
    } catch {
      return NextResponse.json({ success: false, message: "No se pudo leer el PDF local." }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Error al servir el PDF del anexo." }, { status: 500 });
  }
}
