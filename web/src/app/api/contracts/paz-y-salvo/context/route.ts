import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contexto para "Paz y salvo, recomendación y acta de entrega" (cierre del
 * arriendo): datos de las partes + inmueble + canon/fechas y el ESTADO DE PAGO
 * (para poder emitir el paz y salvo solo si el inquilino está al día, o avisar
 * que no hay pruebas de pago en la plataforma). Solo partes del contrato.
 */
export async function GET(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const contractId = new URL(request.url).searchParams.get("contractId")?.trim() ?? "";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const contractSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!contractSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
    const contract = contractSnap.data() as { currentVersionId?: string } | undefined;
    const currentVersionId = contract?.currentVersionId ?? "";
    if (!currentVersionId) return NextResponse.json({ success: false, errors: [{ field: "version", message: "El contrato no tiene versión guardada." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;

    const versionSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (versionSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const p = (person?: { fullName?: string; documentType?: string; documentNumber?: string; phone?: string; city?: string }) => ({
      name: (person?.fullName ?? "").trim(),
      doc: `${person?.documentType ?? ""} ${person?.documentNumber ?? ""}`.trim(),
      phone: (person?.phone ?? "").trim(),
      city: (person?.city ?? "").trim(),
    });

    // Estado de pago desde el calendario (scheduled_payments) de esta versión.
    const schedSnap = await firestore
      .collection("scheduled_payments")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", currentVersionId)
      .limit(400)
      .get()
      .catch(() => null);
    const today = new Date().toISOString().slice(0, 10);
    const sched = (schedSnap?.docs ?? []).map((d) => d.data() as { dueDate?: string; status?: string });
    const hasSchedule = sched.length > 0;
    const due = sched.filter((s) => (s.dueDate ?? "") <= today && s.status !== "cancelled");
    const notPaid = due.filter((s) => s.status !== "reported_paid");
    const overdue = notPaid.filter((s) => (s.dueDate ?? "") < today);
    const alDia = hasSchedule && due.length > 0 && notPaid.length === 0;
    const sinDatos = !hasSchedule;

    return NextResponse.json({
      success: true,
      viewerRole: participant.role,
      landlord: p(payload?.landlord),
      tenant: p(payload?.tenant),
      property: { address: (payload?.property?.address ?? "").trim(), city: (payload?.property?.city ?? "").trim() },
      lease: {
        canon: Number(payload?.lease?.monthlyRent ?? 0),
        startDate: (payload?.lease?.startDate ?? "").trim(),
        endDate: (payload?.lease?.endDate ?? "").trim(),
      },
      payment: {
        hasSchedule,
        sinDatos,
        alDia,
        pendientes: notPaid.length,
        overdue: overdue.length,
        dueTotal: due.length,
      },
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("paz-y-salvo/context", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cargar el contexto." }] }, { status: 500 });
  }
}
