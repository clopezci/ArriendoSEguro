import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

function parseGsUri(gs: string): { bucket: string; objectPath: string } | null {
  if (!gs.startsWith("gs://")) return null;
  const rest = gs.slice(5);
  const i = rest.indexOf("/");
  if (i <= 0) return null;
  return { bucket: rest.slice(0, i), objectPath: rest.slice(i + 1) };
}

/** Sirve la foto (opcional) de una solicitud de mantenimiento a las partes. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    const requestId = url.searchParams.get("requestId") ?? "";
    if (!contractId.trim() || !requestId.trim()) {
      return NextResponse.json({ success: false, message: "Parámetros obligatorios." }, { status: 422 });
    }

    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, message: "Firestore no configurado." }, { status: 503 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
    if (!participant.ok) return participant.response;

    const snap = await firestore.collection("contracts").doc(contractId).collection("maintenance").doc(requestId).get();
    if (!snap.exists) return NextResponse.json({ success: false, message: "Solicitud no encontrada." }, { status: 404 });
    const path = (snap.data() as { photoPath?: string })?.photoPath?.trim();
    if (!path) return NextResponse.json({ success: false, message: "Sin foto." }, { status: 404 });

    const gs = parseGsUri(path);
    if (gs) {
      try {
        const [buf] = await getStorage().bucket(gs.bucket).file(gs.objectPath).download();
        auditEvent("maintenance_photo_downloaded", { contractId, requestId, role: participant.role });
        return new NextResponse(new Uint8Array(buf), {
          status: 200,
          headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" },
        });
      } catch {
        return NextResponse.json({ success: false, message: "No se pudo leer la foto en Storage." }, { status: 502 });
      }
    }

    try {
      const file = await readFile(path);
      auditEvent("maintenance_photo_downloaded", { contractId, requestId, role: participant.role, source: "local" });
      return new NextResponse(file, {
        status: 200,
        headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" },
      });
    } catch {
      return NextResponse.json({ success: false, message: "No se pudo leer la foto local." }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Error al servir la foto." }, { status: 500 });
  }
}
