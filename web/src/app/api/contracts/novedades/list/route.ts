import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    if (!contractId.trim()) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractId", message: "contractId es obligatorio." }] },
        { status: 422 },
      );
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: true, novedades: [] });
    }

    const auth = await requireAuthenticatedUser(request);
    if (!auth.ok) return auth.response;

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!cSnap.exists) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractId", message: "Expediente no encontrado." }] },
        { status: 404 },
      );
    }
    const currentVersionId = (cSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId;

    if (!currentVersionId) {
      return NextResponse.json({ success: true, novedades: [] });
    }

    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId: currentVersionId,
    });
    if (!participant.ok) return participant.response;

    const snap = await firestore.collection("contracts").doc(contractId).collection("novedades").limit(100).get();

    const novedades = snap.docs
      .map((d) => {
        const x = d.data() as Record<string, unknown>;
        return { ...x, id: d.id } as Record<string, unknown> & { id: string };
      })
      .sort((a, b) => String(b["createdAt"] ?? "").localeCompare(String(a["createdAt"] ?? "")));

    return NextResponse.json({ success: true, novedades });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudieron listar las novedades." }] },
      { status: 500 },
    );
  }
}
