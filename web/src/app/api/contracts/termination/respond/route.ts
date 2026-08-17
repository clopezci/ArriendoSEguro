import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant, requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { sendEmail } from "@/services/email/sendEmail";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { terminationResponseEmail } from "@/services/email/emailTemplates";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

/** La CONTRAPARTE responde (acepta o no) el aviso de terminación / no renovación. */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { contractId?: string; accept?: boolean; observation?: string } | null;
    const contractId = body?.contractId?.trim() ?? "";
    const accept = Boolean(body?.accept);
    const observation = (body?.observation ?? "").trim().slice(0, 1000);
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    const contract = cSnap.data() as { currentVersionId?: string; terminationNotice?: { byRole?: string; status?: string } } | undefined;
    const currentVersionId = contract?.currentVersionId ?? "";
    const notice = contract?.terminationNotice;
    if (!currentVersionId || !notice) return NextResponse.json({ success: false, errors: [{ field: "notice", message: "No hay aviso de terminación para responder." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;
    // Solo responde la CONTRAPARTE (no quien registró el aviso).
    if (participant.role === notice.byRole) {
      return NextResponse.json({ success: false, errors: [{ field: "role", message: "Quien registró el aviso no puede responderlo; responde la otra parte." }] }, { status: 403 });
    }

    const now = new Date().toISOString();
    await cSnap.ref.set(
      {
        terminationNotice: {
          ...notice,
          status: accept ? "accepted" : "rejected",
          responseByRole: participant.role,
          responseByEmail: participant.user.email,
          responseObservation: observation,
          respondedAt: now,
          responseEvidence: { ipAddress: requestClientIp(request) ?? "unknown", userAgent: requestUserAgent(request) ?? "unknown", at: now },
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // Avisar a quien registró el aviso (la otra parte principal).
    const vSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const notifier = notice.byRole === "landlord" ? payload?.landlord : payload?.tenant;
    const notifierEmail = (notifier?.email ?? "").trim();
    const notifierPhone = (notifier?.phone ?? "").trim();
    const notifierName = (notifier?.fullName ?? "Hola").trim() || "Hola";
    const responderLabel = participant.role === "landlord" ? "El arrendador (dueño)" : "El arrendatario (inquilino)";
    const base = appConfig.publicUrl.replace(/\/$/, "");
    const link = `${base}/dashboard/contracts/${contractId}/terminacion`;
    if (notifierEmail) {
      const tpl = terminationResponseEmail({ recipientName: notifierName, responderLabel, accepted: accept, observation, link });
      await sendEmail({ to: notifierEmail, subject: tpl.subject, html: tpl.html, text: tpl.text, templateCode: "terminationResponseEmail", relatedEntityType: "contract", relatedEntityId: contractId });
    }
    await sendPhoneNotice({
      to: notifierPhone,
      message: `${responderLabel} ${accept ? "ACEPTÓ" : "NO aceptó"} la terminación/no renovación del arriendo.${observation ? ` Observación: ${observation}` : ""} Detalle: ${link}`,
      templateCode: "generalWa",
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    });
    auditEvent("termination_notice_responded", { contractId, accept, responderRole: participant.role });

    return NextResponse.json({ success: true, status: accept ? "accepted" : "rejected" });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("termination/respond", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo registrar la respuesta." }] }, { status: 500 });
  }
}
