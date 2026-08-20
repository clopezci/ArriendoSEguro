import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant, requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { sendEmail } from "@/services/email/sendEmail";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";
import { terminationResponseEmail } from "@/services/email/emailTemplates";
import { auditEvent } from "@/features/contracts/audit-server";
import { appConfig } from "@/lib/config";
import { TERMINATION_ACK } from "@/domain/contracts/termination";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

/** La CONTRAPARTE responde (acepta o no) el aviso de terminación / no renovación. */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const body = (await request.json().catch(() => null)) as {
      contractId?: string; accept?: boolean; observation?: string;
      effectiveDate?: string; penaltyAmountAgreed?: number; paymentMethod?: string; acknowledged?: boolean;
    } | null;
    const contractId = body?.contractId?.trim() ?? "";
    const accept = Boolean(body?.accept);
    const observation = (body?.observation ?? "").trim().slice(0, 1000);
    const effectiveDate = (body?.effectiveDate ?? "").trim().slice(0, 20);
    const paymentMethod = (body?.paymentMethod ?? "").trim().slice(0, 300);
    const acknowledged = Boolean(body?.acknowledged);
    if (!contractId) return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "contractId obligatorio." }] }, { status: 422 });

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    const contract = cSnap.data() as { currentVersionId?: string; terminationNotice?: { byRole?: string; status?: string; penaltyAmount?: number; penaltyMonths?: number } } | undefined;
    const currentVersionId = contract?.currentVersionId ?? "";
    const notice = contract?.terminationNotice;
    if (!currentVersionId || !notice) return NextResponse.json({ success: false, errors: [{ field: "notice", message: "No hay aviso de terminación para responder." }] }, { status: 422 });

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "by_version", contractVersionId: currentVersionId });
    if (!participant.ok) return participant.response;
    // Solo responde la CONTRAPARTE (no quien registró el aviso).
    if (participant.role === notice.byRole) {
      return NextResponse.json({ success: false, errors: [{ field: "role", message: "Quien registró el aviso no puede responderlo; responde la otra parte." }] }, { status: 403 });
    }

    // Monto acordado: no puede superar el MÁXIMO LEGAL (meses × canon) del aviso.
    const maxAmount = Math.max(0, Number(notice.penaltyAmount ?? 0));
    let penaltyAmountAgreed = Number(body?.penaltyAmountAgreed);
    if (!Number.isFinite(penaltyAmountAgreed) || penaltyAmountAgreed < 0) penaltyAmountAgreed = maxAmount;
    if (accept) {
      if (!acknowledged) {
        return NextResponse.json({ success: false, errors: [{ field: "acknowledged", message: "Debes aceptar la declaración (ArriendoSeguro solo envía la comunicación) para continuar." }] }, { status: 422 });
      }
      if (maxAmount > 0 && penaltyAmountAgreed > maxAmount) {
        return NextResponse.json({ success: false, errors: [{ field: "penaltyAmountAgreed", message: `El valor de la indemnización no puede superar el máximo legal ($${maxAmount.toLocaleString("es-CO")}).` }] }, { status: 422 });
      }
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
          // Formulario de aceptación de la parte afectada (acreedora).
          acceptance: accept
            ? {
                effectiveDate, penaltyAmountAgreed, paymentMethod, acknowledged,
                // Texto LITERAL del descargo de intermediación que aceptó (expediente).
                acknowledgedText: TERMINATION_ACK.intermediation,
                byRole: participant.role, byEmail: participant.user.email,
                evidence: { ipAddress: requestClientIp(request) ?? "unknown", userAgent: requestUserAgent(request) ?? "unknown", at: now },
                at: now,
              }
            : null,
          // Trazabilidad del pago (la marca luego la parte que recibe).
          paymentTrace: accept ? { status: "pending", updatedAt: null, note: "" } : null,
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
    // Resumen de las condiciones acordadas (solo si aceptó).
    const terms = accept
      ? [
          effectiveDate ? `Termina a partir de: ${effectiveDate}.` : "",
          penaltyAmountAgreed > 0 ? `Indemnización acordada: $${penaltyAmountAgreed.toLocaleString("es-CO")}.` : "Sin indemnización.",
          paymentMethod ? `Medio de pago para recibir: ${paymentMethod}.` : "",
        ].filter(Boolean).join(" ")
      : "";
    if (notifierEmail) {
      const tpl = terminationResponseEmail({ recipientName: notifierName, responderLabel, accepted: accept, observation: [observation, terms].filter(Boolean).join(" — "), link });
      await sendEmail({ to: notifierEmail, subject: tpl.subject, html: tpl.html, text: tpl.text, templateCode: "terminationResponseEmail", relatedEntityType: "contract", relatedEntityId: contractId });
    }
    await sendPhoneNotice({
      to: notifierPhone,
      message: `${responderLabel} ${accept ? "ACEPTÓ" : "NO aceptó"} la terminación/no renovación del arriendo.${terms ? ` ${terms}` : ""}${observation ? ` Observación: ${observation}` : ""} ArriendoSeguro solo envía esta comunicación; la transacción la hacen directamente entre ustedes. Detalle: ${link}`,
      templateCode: "generalWa",
      relatedEntityType: "contract",
      relatedEntityId: contractId,
    });
    // A la parte que RECIBE el pago (quien aceptó): enlace para marcar luego si le pagaron.
    if (accept) {
      const responderContact = participant.role === "landlord" ? payload?.landlord : payload?.tenant;
      const responderPhone = (responderContact?.phone ?? "").trim();
      if (responderPhone) {
        await sendPhoneNotice({
          to: responderPhone,
          message: `Registramos tu aceptación de la terminación del arriendo.${penaltyAmountAgreed > 0 ? ` Cuando recibas el pago de $${penaltyAmountAgreed.toLocaleString("es-CO")}` : " Cuando se cierre el tema"}, entra aquí y déjalo registrado (te pagaron / no): ${link}`,
          templateCode: "generalWa",
          relatedEntityType: "contract",
          relatedEntityId: contractId,
        });
      }
    }
    auditEvent("termination_notice_responded", { contractId, accept, responderRole: participant.role });

    return NextResponse.json({ success: true, status: accept ? "accepted" : "rejected" });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.error("termination/respond", e);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo registrar la respuesta." }] }, { status: 500 });
  }
}
