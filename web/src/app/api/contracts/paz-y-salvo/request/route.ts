import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getUploadToken } from "@/lib/payments/uploadTokenStore";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { sendEmail } from "@/services/email/sendEmail";
import { appConfig } from "@/lib/config";
import { auditEvent } from "@/features/contracts/audit-server";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

/**
 * El INQUILINO (desde su enlace público de pago) solicita al dueño el paz y salvo
 * y la carta de recomendación. Le llega al dueño un aviso (WhatsApp + correo) con
 * el enlace directo para generarlos. No expone datos: se identifica por el token.
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { token?: string } | null;
    const token = body?.token?.trim() ?? "";
    if (!token) return NextResponse.json({ success: false, errors: [{ field: "token", message: "Falta el token." }] }, { status: 422 });

    const tok = await getUploadToken(firestore, token);
    if (!tok) return NextResponse.json({ success: false, errors: [{ field: "token", message: "Enlace no válido." }] }, { status: 404 });

    const versionSnap = await firestore.collection("contract_versions").doc(tok.contractVersionId).get();
    const payload = (versionSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const landlordPhone = (payload?.landlord?.phone ?? "").trim();
    const landlordEmail = (payload?.landlord?.email ?? "").trim();
    const tenantName = (payload?.tenant?.fullName ?? "El inquilino").trim() || "El inquilino";
    const address = (payload?.property?.address ?? "").trim();

    const base = appConfig.publicUrl.replace(/\/$/, "");
    const link = `${base}/dashboard/contracts/${tok.contractId}/paz-y-salvo`;

    await sendPhoneNotice({
      to: landlordPhone,
      message: `${tenantName} te solicitó el PAZ Y SALVO y la carta de recomendación del arriendo${address ? ` de ${address}` : ""}. Genéralos y envíalos aquí: ${link}`,
      templateCode: "generalWa",
      relatedEntityType: "contract",
      relatedEntityId: tok.contractId,
    });
    if (landlordEmail) {
      await sendEmail({
        to: landlordEmail,
        subject: "Tu inquilino solicitó su paz y salvo y recomendación",
        html: `<p><strong>${tenantName}</strong> te solicitó el <strong>paz y salvo</strong> y la <strong>carta de recomendación</strong> del arriendo${address ? ` de ${address}` : ""}.</p><p><a href="${link}" style="display:inline-block;background:#5646E5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Generar y enviar</a></p>`,
        text: `${tenantName} te solicitó el paz y salvo y la carta de recomendación${address ? ` del arriendo de ${address}` : ""}. Genéralos aquí: ${link}`,
        templateCode: "pazYSalvoRequest",
        relatedEntityType: "contract",
        relatedEntityId: tok.contractId,
      });
    }
    auditEvent("paz_y_salvo_requested_by_tenant", { contractId: tok.contractId });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("paz-y-salvo/request", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo enviar la solicitud." }] }, { status: 500 });
  }
}
