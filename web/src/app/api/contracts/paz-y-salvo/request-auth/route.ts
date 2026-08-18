import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { sendEmail } from "@/services/email/sendEmail";
import { appConfig } from "@/lib/config";
import { auditEvent } from "@/features/contracts/audit-server";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

/**
 * El INQUILINO (autenticado, desde su hub) solicita al dueño el paz y salvo, la
 * recomendación y el acta de entrega. Al dueño le llega WhatsApp + correo con los
 * enlaces para generarlos. Variante autenticada de paz-y-salvo/request (token).
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const body = (await request.json().catch(() => null)) as { contractId?: string } | null;
    const contractId = body?.contractId?.trim() ?? "";
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    const currentVersionId = (cSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId ?? "";
    if (!currentVersionId) return NextResponse.json({ success: false, errors: [{ field: "version", message: "Contrato sin versión guardada." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;

    const vSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const landlordPhone = (payload?.landlord?.phone ?? "").trim();
    const landlordEmail = (payload?.landlord?.email ?? "").trim();
    const tenantName = (payload?.tenant?.fullName ?? "El inquilino").trim() || "El inquilino";
    const address = (payload?.property?.address ?? "").trim();
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const link = `${base}/dashboard/contracts/${contractId}/paz-y-salvo`;
    const inventarioFinalLink = `${base}/nuevo/gestionar/${contractId}/inventario?kind=final`;

    await sendPhoneNotice({
      to: landlordPhone,
      message: `${tenantName} solicitó el CIERRE del arriendo${address ? ` de ${address}` : ""}: paz y salvo, recomendación y acta de entrega. Paz y salvo/recomendación: ${link} · Acta: ${inventarioFinalLink}`,
      templateCode: "generalWa",
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    });
    if (landlordEmail) {
      await sendEmail({
        to: landlordEmail,
        subject: "Tu inquilino solicitó su paz y salvo y recomendación",
        html: `<p><strong>${tenantName}</strong> te solicitó el <strong>paz y salvo</strong>, la <strong>carta de recomendación</strong> y el <strong>acta de entrega</strong>${address ? ` del arriendo de ${address}` : ""}.</p><p><a href="${link}" style="display:inline-block;background:#5646E5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Generar y enviar</a></p>`,
        text: `${tenantName} te solicitó el paz y salvo, la recomendación y el acta de entrega. Genéralos aquí: ${link}`,
        templateCode: "pazYSalvoRequest",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
    }
    auditEvent("paz_y_salvo_requested_by_tenant", { contractId, via: "hub_auth" });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("paz-y-salvo/request-auth", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo enviar la solicitud." }] }, { status: 500 });
  }
}
