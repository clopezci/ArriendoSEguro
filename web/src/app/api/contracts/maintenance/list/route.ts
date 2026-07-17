import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

/** Lista las solicitudes de mantenimiento del expediente (para las partes). */
export async function GET(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
      { status: 503 },
    );
  }

  const contractId = new URL(request.url).searchParams.get("contractId") ?? "";
  if (!contractId) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Falta contractId." }] }, { status: 422 });
  }

  const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
  if (!participant.ok) return participant.response;

  const snap = await firestore
    .collection("contracts")
    .doc(contractId)
    .collection("maintenance")
    .orderBy("createdAt", "desc")
    .get()
    .catch(() => null);

  const requests = (snap?.docs ?? []).map((d) => {
    const x = d.data() as Record<string, unknown>;
    return {
      id: String(x.id ?? d.id),
      title: String(x.title ?? ""),
      description: String(x.description ?? ""),
      category: String(x.category ?? "other"),
      status: String(x.status ?? "open"),
      rejectionCount: Number(x.rejectionCount ?? 0),
      reportedByRole: String(x.reportedByRole ?? ""),
      reportedByEmail: String(x.reportedByEmail ?? ""),
      hasPhoto: Boolean(x.photoPath),
      responses: Array.isArray(x.responses) ? x.responses : [],
      createdAt: String(x.createdAt ?? ""),
      updatedAt: String(x.updatedAt ?? ""),
      resolvedAt: x.resolvedAt ? String(x.resolvedAt) : null,
    };
  });

  return NextResponse.json({ success: true, myRole: participant.role, requests });
}
