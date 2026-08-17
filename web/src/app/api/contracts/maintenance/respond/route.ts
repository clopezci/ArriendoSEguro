import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { applyOwnerResponse, isInDispute, roleBucket, RESPONSE_ACTION_LABELS, MAINTENANCE_REASON_MAX } from "@/domain/maintenance/maintenance";
import type { MaintenanceRequest } from "@/domain/maintenance/maintenance";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";
import { sendEmail } from "@/services/email/sendEmail";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

const schema = z.object({
  contractId: z.string().min(3),
  requestId: z.string().min(3),
  action: z.enum(["will_review", "accept", "reject"]),
  reason: z.string().max(MAINTENANCE_REASON_MAX).optional(),
});

/**
 * La CONTRAPARTE responde una solicitud/reporte: "revisaré", "de acuerdo /
 * atenderé" o "no procede". Quien creó la solicitud NO puede responderla; la
 * responde la otra parte (el dueño responde lo del inquilino y viceversa). Dos
 * "no procede" seguidos → disputa (se ofrece abogado aliado).
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "body", message: "Datos inválidos." }] }, { status: 422 });
    }
    const { contractId, requestId, action, reason } = parsed.data;
    if (action === "reject" && !(reason ?? "").trim()) {
      return NextResponse.json({ success: false, errors: [{ field: "reason", message: "Indica el motivo (por qué no procede)." }] }, { status: 422 });
    }

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
    if (!participant.ok) return participant.response;

    const ref = firestore.collection("contracts").doc(contractId).collection("maintenance").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "requestId", message: "Solicitud no encontrada." }] }, { status: 404 });
    }
    const cur = snap.data() as MaintenanceRequest;
    if (cur.status === "resolved" || cur.status === "cancelled") {
      return NextResponse.json({ success: false, errors: [{ field: "status", message: "La solicitud ya está cerrada." }] }, { status: 409 });
    }
    // Responde la CONTRAPARTE (quien no la creó): no puedes responder la tuya.
    if (roleBucket(participant.role) === roleBucket(cur.reportedByRole)) {
      return NextResponse.json({ success: false, errors: [{ field: "role", message: "Esta solicitud la responde la otra parte, no tú." }] }, { status: 403 });
    }

    const now = new Date().toISOString();
    const next = applyOwnerResponse(
      { status: cur.status, rejectionCount: cur.rejectionCount ?? 0, responses: cur.responses ?? [] },
      action,
      reason ?? null,
      now,
      participant.role,
    );
    await ref.set(
      { status: next.status, rejectionCount: next.rejectionCount, responses: next.responses, updatedAt: now },
      { merge: true },
    );

    // Notificar a QUIEN CREÓ la solicitud (y, si hay disputa, a ambas partes).
    const vSnap = await firestore.collection("contract_versions").doc(cur.contractVersionId).get();
    const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const creatorIsLandlord = roleBucket(cur.reportedByRole) === "landlord";
    const creatorEmail = (cur.reportedByEmail || (creatorIsLandlord ? payload?.landlord?.email : payload?.tenant?.email) || "").trim();
    const creatorPhone = ((creatorIsLandlord ? payload?.landlord?.phone : payload?.tenant?.phone) || "").trim();
    const landlordEmail = (payload?.landlord?.email ?? "").trim();
    const actionLabel = RESPONSE_ACTION_LABELS[action];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const link = appUrl ? `${appUrl}/dashboard/contracts/${contractId}/mantenimiento` : "";

    const dispute = isInDispute(next.status);
    if (dispute) {
      const html =
        `<p>La solicitud <strong>"${cur.title}"</strong> acumuló varias negativas y quedó marcada como <strong>en disputa</strong>.</p>` +
        `<p>Si no logran un acuerdo, pueden consultar con un <strong>abogado aliado</strong> desde la sección de solicitudes.</p>` +
        (link ? `<p><a href="${link}">Abrir solicitudes</a></p>` : "");
      for (const to of [creatorEmail, landlordEmail].filter(Boolean)) {
        await sendEmail({
          to,
          subject: `Solicitud en disputa: ${cur.title}`,
          html,
          text: `La solicitud "${cur.title}" quedó en disputa. Pueden consultar con un abogado aliado.${link ? ` ${link}` : ""}`,
          templateCode: "maintenanceDisputeEmail",
          relatedEntityType: "contract",
          relatedEntityId: contractId,
        });
      }
    } else if (creatorEmail) {
      await sendEmail({
        to: creatorEmail,
        subject: `Respuesta a tu solicitud: ${cur.title}`,
        html:
          `<p>La otra parte respondió tu solicitud <strong>"${cur.title}"</strong>: <strong>${actionLabel}</strong>.</p>` +
          (action === "reject" ? `<p><strong>Motivo:</strong> ${(reason ?? "").trim()}</p><p>Si no estás de acuerdo, puedes insistir desde la plataforma.</p>` : "") +
          (link ? `<p><a href="${link}">Ver el estado</a></p>` : ""),
        text: `Respondieron tu solicitud "${cur.title}": ${actionLabel}.${action === "reject" ? ` Motivo: ${(reason ?? "").trim()}.` : ""}${link ? ` ${link}` : ""}`,
        templateCode: "maintenanceResponseEmail",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
      await sendPhoneNotice({
        to: creatorPhone,
        message: `Respondieron tu solicitud "${cur.title}": ${actionLabel}.${link ? ` Revísala aquí: ${link}` : " Revísala en la plataforma."}`,
        templateCode: "maintenanceWa",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
    }

    auditEvent("maintenance_responded", { contractId, requestId, action, status: next.status, dispute, byRole: participant.role });
    return NextResponse.json({ success: true, status: next.status, rejectionCount: next.rejectionCount, dispute });
  } catch (err) {
    await logServerError("maintenance/respond", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo registrar la respuesta." }] }, { status: 500 });
  }
}
