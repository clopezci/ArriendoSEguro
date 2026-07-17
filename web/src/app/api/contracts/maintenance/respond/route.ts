import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { applyOwnerResponse, isInDispute, MAINTENANCE_REASON_MAX } from "@/domain/maintenance/maintenance";
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
  action: z.enum(["accept", "reject"]),
  reason: z.string().max(MAINTENANCE_REASON_MAX).optional(),
});

/** El DUEÑO (arrendador) acepta o rechaza una solicitud de reparación. */
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

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
    if (!participant.ok) return participant.response;
    if (participant.role !== "landlord") {
      return NextResponse.json({ success: false, errors: [{ field: "role", message: "Solo el arrendador puede responder solicitudes de reparación." }] }, { status: 403 });
    }
    if (action === "reject" && !(reason ?? "").trim()) {
      return NextResponse.json({ success: false, errors: [{ field: "reason", message: "Indica el motivo del rechazo." }] }, { status: 422 });
    }

    const ref = firestore.collection("contracts").doc(contractId).collection("maintenance").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "requestId", message: "Solicitud no encontrada." }] }, { status: 404 });
    }
    const cur = snap.data() as MaintenanceRequest;
    if (cur.status === "resolved" || cur.status === "cancelled") {
      return NextResponse.json({ success: false, errors: [{ field: "status", message: "La solicitud ya está cerrada." }] }, { status: 409 });
    }

    const now = new Date().toISOString();
    const next = applyOwnerResponse(
      { status: cur.status, rejectionCount: cur.rejectionCount ?? 0, responses: cur.responses ?? [] },
      action,
      reason ?? null,
      now,
    );
    await ref.set(
      { status: next.status, rejectionCount: next.rejectionCount, responses: next.responses, updatedAt: now },
      { merge: true },
    );

    // Cargar partes para notificar al inquilino (reportante) y, si hay disputa, a ambos.
    const vSnap = await firestore.collection("contract_versions").doc(cur.contractVersionId).get();
    const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const tenantEmail = (payload?.tenant?.email ?? cur.reportedByEmail ?? "").trim();
    const tenantPhone = (payload?.tenant?.phone ?? "").trim();
    const landlordEmail = (payload?.landlord?.email ?? "").trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const link = appUrl ? `${appUrl}/dashboard/contracts/${contractId}/mantenimiento` : "";

    const dispute = isInDispute(next.status);
    if (dispute) {
      // Conflicto: se avisa a AMBAS partes y se les ofrece la asesoría jurídica.
      const html =
        `<p>La solicitud de reparación <strong>"${cur.title}"</strong> lleva varios rechazos y quedó marcada como ` +
        `<strong>en disputa</strong>.</p>` +
        `<p>Si no logran un acuerdo, pueden consultar con un <strong>abogado experto en vivienda</strong> (aliado) desde la sección de reparaciones.</p>` +
        (link ? `<p><a href="${link}">Abrir reparaciones</a></p>` : "");
      for (const to of [tenantEmail, landlordEmail].filter(Boolean)) {
        await sendEmail({
          to,
          subject: `Solicitud de reparación en disputa: ${cur.title}`,
          html,
          text: `La solicitud "${cur.title}" quedó en disputa. Pueden consultar con un abogado aliado desde reparaciones.${link ? ` ${link}` : ""}`,
          templateCode: "maintenanceDisputeEmail",
          relatedEntityType: "contract",
          relatedEntityId: contractId,
        });
      }
    } else if (tenantEmail) {
      // Respuesta normal (aceptada o rechazada): avisar al inquilino.
      const accepted = action === "accept";
      await sendEmail({
        to: tenantEmail,
        subject: accepted ? `Tu solicitud de reparación fue aceptada` : `Tu solicitud de reparación fue rechazada`,
        html:
          `<p>El arrendador ${accepted ? "aceptó" : "rechazó"} tu solicitud <strong>"${cur.title}"</strong>.</p>` +
          (accepted ? "" : `<p><strong>Motivo:</strong> ${(reason ?? "").trim()}</p><p>Si no estás de acuerdo, puedes insistir desde la plataforma.</p>`) +
          (link ? `<p><a href="${link}">Ver el estado</a></p>` : ""),
        text: `El arrendador ${accepted ? "aceptó" : "rechazó"} tu solicitud "${cur.title}".${accepted ? "" : ` Motivo: ${(reason ?? "").trim()}.`}${link ? ` ${link}` : ""}`,
        templateCode: "maintenanceResponseEmail",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
      await sendPhoneNotice({
        to: tenantPhone,
        message: `El arrendador ${accepted ? "aceptó" : "rechazó"} tu solicitud de reparación "${cur.title}". Revísala en la plataforma.`,
        templateCode: "maintenanceWa",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
    }

    auditEvent("maintenance_responded", { contractId, requestId, action, status: next.status, dispute });
    return NextResponse.json({ success: true, status: next.status, rejectionCount: next.rejectionCount, dispute });
  } catch (err) {
    await logServerError("maintenance/respond", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo registrar la respuesta." }] }, { status: 500 });
  }
}
