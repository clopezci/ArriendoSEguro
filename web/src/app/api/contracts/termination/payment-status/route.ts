import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

/**
 * La parte que RECIBE la indemnización (quien aceptó la terminación) deja la
 * trazabilidad: si ya le pagaron o no. ArriendoSeguro NO procesa ese pago; solo
 * guarda la constancia. Puede volver a actualizarla cuando quiera.
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { contractId?: string; paid?: boolean; note?: string } | null;
    const contractId = body?.contractId?.trim() ?? "";
    const paid = Boolean(body?.paid);
    const note = (body?.note ?? "").trim().slice(0, 500);
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    const contract = cSnap.data() as {
      currentVersionId?: string;
      terminationNotice?: { byRole?: string; status?: string; acceptance?: { byRole?: string } | null };
    } | undefined;
    const currentVersionId = contract?.currentVersionId ?? "";
    const notice = contract?.terminationNotice;
    if (!currentVersionId || !notice) return NextResponse.json({ success: false, errors: [{ field: "notice", message: "No hay terminación registrada." }] }, { status: 422 });
    if (notice.status !== "accepted" || !notice.acceptance) {
      return NextResponse.json({ success: false, errors: [{ field: "status", message: "La terminación aún no ha sido aceptada." }] }, { status: 422 });
    }

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;
    // Solo la parte que ACEPTÓ (la que recibe el pago) marca la trazabilidad.
    if (participant.role !== notice.acceptance.byRole) {
      return NextResponse.json({ success: false, errors: [{ field: "role", message: "Solo la parte que recibe el pago puede marcar esta trazabilidad." }] }, { status: 403 });
    }

    const now = new Date().toISOString();
    await cSnap.ref.set(
      {
        terminationNotice: {
          ...notice,
          paymentTrace: { status: paid ? "paid" : "unpaid", updatedAt: now, note },
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // Avisar a la otra parte (la que paga) el estado que reportó quien recibe.
    const vSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const payer = notice.byRole === "landlord" ? payload?.landlord : payload?.tenant;
    const payerPhone = (payer?.phone ?? "").trim();
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const link = `${base}/dashboard/contracts/${contractId}/terminacion`;
    if (payerPhone) {
      await sendPhoneNotice({
        to: payerPhone,
        message: paid
          ? `La otra parte confirmó que recibió el pago de la terminación del arriendo. Constancia: ${link}`
          : `La otra parte reportó que AÚN NO ha recibido el pago de la terminación del arriendo.${note ? ` Nota: ${note}` : ""} Detalle: ${link}`,
        templateCode: "generalWa",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
    }
    auditEvent("termination_payment_status", { contractId, paid });

    return NextResponse.json({ success: true, status: paid ? "paid" : "unpaid" });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("termination/payment-status", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo registrar el estado del pago." }] }, { status: 500 });
  }
}
