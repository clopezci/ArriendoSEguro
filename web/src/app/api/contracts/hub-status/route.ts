import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado de "gestionado" de las tarjetas del hub «Administra tu arriendo», para
 * pintar el chulo verde ✓ cuando algo ya se hizo (y no solo cuando está pendiente).
 * Una sola llamada para no multiplicar fetches en el cliente. Solo partes del contrato.
 */
export async function GET(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: true, managed: {} });
    const contractId = new URL(request.url).searchParams.get("contractId")?.trim() ?? "";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const cRef = firestore.collection("contracts").doc(contractId);
    const cSnap = await cRef.get();
    if (!cSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
    const c = cSnap.data() as { currentVersionId?: string; status?: string; pazYSalvoSentAt?: string } | undefined;
    const currentVersionId = c?.currentVersionId ?? "";

    const participant = await requireContractParticipant(request, firestore, contractId, currentVersionId ? { kind: "by_version", contractVersionId: currentVersionId } : { kind: "current" });
    if (!participant.ok) return participant.response;

    const [revLtT, revTtL, maint, nov, pagos, annexes] = await Promise.all([
      firestore.collection("reputation_reviews").doc(`${contractId}__landlord_to_tenant`).get().catch(() => null),
      firestore.collection("reputation_reviews").doc(`${contractId}__tenant_to_landlord`).get().catch(() => null),
      cRef.collection("maintenance").limit(1).get().catch(() => null),
      cRef.collection("novedades").limit(1).get().catch(() => null),
      firestore.collection("payments_log").where("contractId", "==", contractId).limit(1).get().catch(() => null),
      firestore.collection("contract_annexes").where("contractId", "==", contractId).limit(20).get().catch(() => null),
    ]);
    const annexTypes = new Set((annexes?.docs ?? []).map((d) => (d.data() as { annexType?: string }).annexType ?? ""));

    return NextResponse.json({
      success: true,
      managed: {
        pazYSalvo: Boolean(c?.pazYSalvoSentAt),
        calificado: Boolean(revLtT?.exists || revTtL?.exists),
        renovado: annexTypes.has("renewal_addendum"),
        actaFinal: annexTypes.has("final_delivery_act"),
        notarial: annexTypes.has("notarial_authentication"),
        cerrado: c?.status === "closed",
        mantenimiento: (maint?.size ?? 0) > 0,
        novedades: (nov?.size ?? 0) > 0,
        pagos: (pagos?.size ?? 0) > 0,
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("contracts/hub-status", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo consultar el estado." }] }, { status: 500 });
  }
}
