import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contexto para la pantalla de terminación / no renovación. Solo partes. */
export async function GET(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const contractId = new URL(request.url).searchParams.get("contractId")?.trim() ?? "";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!cSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
    const contract = cSnap.data() as { currentVersionId?: string; terminationNotice?: Record<string, unknown> } | undefined;
    const currentVersionId = contract?.currentVersionId ?? "";
    if (!currentVersionId) return NextResponse.json({ success: false, errors: [{ field: "version", message: "El contrato no tiene versión guardada." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;

    const vSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;

    return NextResponse.json({
      success: true,
      viewerRole: participant.role,
      canon: Number(payload?.lease?.monthlyRent ?? 0),
      startDate: (payload?.lease?.startDate ?? "").trim(),
      endDate: (payload?.lease?.endDate ?? "").trim(),
      propertyAddress: (payload?.property?.address ?? "").trim(),
      notice: contract?.terminationNotice ?? null,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("termination/context", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cargar el contexto." }] }, { status: 500 });
  }
}
