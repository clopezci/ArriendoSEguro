import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant, requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { sendEmail } from "@/services/email/sendEmail";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { terminationNoticeEmail } from "@/services/email/emailTemplates";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";
import {
  earlyTerminationPenaltyMonths,
  terminationLegalText,
  terminationTypeLabel,
  NOTICE_MONTHS,
  type TerminationType,
  type LeasePhase,
} from "@/domain/contracts/termination";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

/**
 * Registra un AVISO de terminación / no renovación (con evidencia) y notifica a la
 * contraparte por correo + WhatsApp con el enlace para responder. La terminación
 * anticipada exige DOBLE validación de la penalización (accepted1 + accepted2).
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const body = (await request.json().catch(() => null)) as
      | { contractId?: string; type?: TerminationType; phase?: LeasePhase; observation?: string; accepted1?: boolean; accepted2?: boolean }
      | null;
    const contractId = body?.contractId?.trim() ?? "";
    const type: TerminationType = body?.type === "early" ? "early" : "non_renewal";
    const phase: LeasePhase = body?.phase === "renewal" ? "renewal" : "initial";
    const observation = (body?.observation ?? "").trim().slice(0, 1000);
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });
    // Terminación anticipada: doble validación de la penalización.
    if (type === "early" && !(body?.accepted1 && body?.accepted2)) {
      return NextResponse.json({ success: false, errors: [{ field: "consent", message: "Debes aceptar las dos casillas de la penalización para continuar." }] }, { status: 422 });
    }

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    const currentVersionId = (cSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId ?? "";
    if (!currentVersionId) return NextResponse.json({ success: false, errors: [{ field: "version", message: "El contrato no tiene versión guardada." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;
    const byRole = participant.role;

    const vSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const payload = (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput } | undefined)?.contractPayload;
    const monthlyRent = Number(payload?.lease?.monthlyRent ?? 0);
    const penaltyMonths = type === "early" ? earlyTerminationPenaltyMonths(byRole, phase) : 0;
    const penaltyAmount = Math.round(monthlyRent * penaltyMonths);

    // Contraparte = la otra parte principal (dueño <-> inquilino).
    const counter = byRole === "landlord" ? payload?.tenant : payload?.landlord;
    const counterEmail = (counter?.email ?? "").trim();
    const counterPhone = (counter?.phone ?? "").trim();
    const counterName = (counter?.fullName ?? "la otra parte").trim() || "la otra parte";
    const byLabel = byRole === "landlord" ? "El arrendador (dueño)" : "El arrendatario (inquilino)";
    const typeLabel = terminationTypeLabel(type);
    const detailLines = terminationLegalText({ type, byRole, phase, monthlyRent, penaltyMonths });

    const now = new Date().toISOString();
    const notice = {
      type,
      byRole,
      byUid: participant.user.uid,
      byEmail: participant.user.email,
      phase,
      penaltyMonths,
      penaltyAmount,
      noticeMonths: NOTICE_MONTHS,
      observation,
      status: "notified" as const,
      createdAt: now,
      evidence: {
        ipAddress: requestClientIp(request) ?? "unknown",
        userAgent: requestUserAgent(request) ?? "unknown",
        acceptedPenalty: type === "early",
        at: now,
      },
      responseByRole: null,
      responseObservation: null,
      respondedAt: null,
    };
    await cSnap.ref.set({ terminationNotice: notice, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    const base = appConfig.publicUrl.replace(/\/$/, "");
    const link = `${base}/dashboard/contracts/${contractId}/terminacion`;
    if (counterEmail) {
      const tpl = terminationNoticeEmail({ recipientName: counterName, byLabel, typeLabel, detailLines, observation, link });
      await sendEmail({ to: counterEmail, subject: tpl.subject, html: tpl.html, text: tpl.text, templateCode: "terminationNoticeEmail", relatedEntityType: "contract", relatedEntityId: contractId });
    }
    const waPenalty = penaltyMonths > 0 ? ` Indemnización estimada: $${penaltyAmount.toLocaleString("es-CO")} (${penaltyMonths} meses de canon).` : "";
    await sendPhoneNotice({
      to: counterPhone,
      message: `${byLabel} registró un ${typeLabel.toLowerCase()} de tu contrato de arriendo.${waPenalty} Revisa y responde (aceptar o no) aquí: ${link}`,
      templateCode: "generalWa",
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    });
    auditEvent("termination_notice_registered", { contractId, type, byRole, penaltyMonths });

    return NextResponse.json({ success: true, penaltyMonths, penaltyAmount });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("termination/notify", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo registrar el aviso." }] }, { status: 500 });
  }
}
