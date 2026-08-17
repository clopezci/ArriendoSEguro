import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { loadCurrentContractContext, requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";
import {
  REPUTATION_DIRECTIONS,
  REPUTATION_CRITERIA,
  REPLICA_WINDOW_HOURS,
  directionForRaterRole,
  lowCriteria,
  validateRatings,
  type ReputationDirection,
} from "@/domain/reputation/criteria";
import {
  recomputeAggregateForSubject,
  runAntifraudOnSubmit,
} from "@/lib/reputation/aggregate-store";
import { sendEmail } from "@/services/email/sendEmail";
import { sendPhoneNotice } from "@/services/notify/phoneChannel";

export const runtime = "nodejs";

const REVIEWS_COLLECTION = "reputation_reviews";
/** Estados de contrato que habilitan calificar (tras el cierre/firma). */
const RATEABLE_STATUSES = new Set(["signed", "closed", "finished", "completed"]);

type Err = { success: false; errors: { field: string; message: string }[] };

const schema = z.object({
  contractId: z.string().min(3),
  direction: z.enum(REPUTATION_DIRECTIONS as [ReputationDirection, ...ReputationDirection[]]),
  ratings: z.record(z.string(), z.number()),
});

export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "body", message: "Datos de calificación inválidos." }] },
        { status: 422 },
      );
    }
    const { contractId, direction, ratings } = parsed.data;

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
    if (!participant.ok) return participant.response;

    // La dirección debe corresponder al rol de quien califica.
    const allowed = directionForRaterRole(participant.role);
    if (!allowed) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "direction", message: "Tu rol no puede emitir calificaciones en esta fase." }] },
        { status: 403 },
      );
    }
    if (allowed !== direction) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "direction", message: "La dirección no corresponde a tu rol en el contrato." }] },
        { status: 403 },
      );
    }

    const ctx = await loadCurrentContractContext(firestore, contractId);
    if (!ctx) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "contract", message: "No se pudo cargar la versión del contrato." }] },
        { status: 422 },
      );
    }

    // Gate: solo se califica tras el cierre/firma del arriendo.
    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    const status = String((cSnap.data() as { status?: string } | undefined)?.status ?? "draft");
    if (!RATEABLE_STATUSES.has(status)) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [
            {
              field: "status",
              message: "La calificación estará disponible cuando el contrato esté firmado o cerrado.",
            },
          ],
        },
        { status: 409 },
      );
    }

    const check = validateRatings(direction, ratings);
    if (!check.ok) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "ratings", message: check.error }] },
        { status: 422 },
      );
    }

    const subjectParty =
      direction === "landlord_to_tenant" ? ctx.contractPayload?.tenant : ctx.contractPayload?.landlord;
    const subjectEmail = subjectParty?.email?.trim().toLowerCase() ?? null;
    const subjectPhone = subjectParty?.phone?.trim() ?? null;
    const subjectRole = direction === "landlord_to_tenant" ? "tenant" : "landlord";

    // Disparador de réplica: si alguna variable quedó "baja", el calificado
    // recibe un aviso con ventana de 48h para responder o registrar un acuerdo.
    const lowList = lowCriteria(direction, check.values);
    const isLow = lowList.length > 0;

    const now = new Date().toISOString();
    const replyDeadline = isLow
      ? new Date(Date.now() + REPLICA_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
      : null;
    // Un único documento por (contrato, dirección): quien califica puede actualizar el suyo.
    const ref = firestore.collection(REVIEWS_COLLECTION).doc(`${contractId}__${direction}`);
    const existed = (await ref.get()).exists;
    await ref.set(
      {
        contractId,
        contractVersionId: ctx.contractVersionId,
        direction,
        ratings: check.values,
        overall: check.overall,
        raterUid: participant.user.uid,
        raterEmail: participant.user.email,
        raterRole: participant.role,
        subjectEmail,
        subjectRole,
        status: "active",
        lowRating: isLow,
        lowCriteriaKeys: lowList.map((c) => c.key),
        replyDeadline,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
        ...(existed ? {} : { createdAt: now, createdAtServer: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );

    auditEvent("reputation_review_submitted", {
      contractId,
      direction,
      overall: check.overall,
      updated: existed,
    });

    // Mantener el agregado privado del sujeto y correr anti-fraude (flag-only).
    // No debe romper el guardado de la calificación si algo falla.
    if (subjectEmail) {
      try {
        await recomputeAggregateForSubject(firestore, subjectEmail);
        await runAntifraudOnSubmit(firestore, {
          raterUid: participant.user.uid,
          raterEmail: participant.user.email,
          subjectEmail,
          contractId,
          createdAt: now,
        });
      } catch (aggErr) {
        await logServerError("reputation/aggregate", aggErr);
      }

      // Aviso al calificado (derecho de réplica). Best-effort; no rompe el guardado.
      try {
        const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/contracts/${contractId}/reputacion`;
        const lowLabels = lowList.map((c) => `"${c.label}"`).join(", ");
        // Resumen de la calificación (cómo quedó) para incluirlo en el aviso.
        const starsOf = (n: number) => "★".repeat(Math.max(0, Math.min(5, Math.round(n)))) + "☆".repeat(Math.max(0, 5 - Math.round(n)));
        const crit = REPUTATION_CRITERIA[direction];
        const overallStars = starsOf(check.overall);
        const summaryRowsHtml = crit
          .map((c) => `<tr><td style="padding:2px 8px;color:#334155;">${c.label}</td><td style="padding:2px 8px;font-weight:bold;color:#0f172a;">${starsOf(Number(check.values[c.key] ?? 0))} ${Number(check.values[c.key] ?? 0)}/5</td></tr>`)
          .join("");
        const summaryHtml =
          `<div style="margin:12px 0;border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;">` +
          `<p style="margin:0 0 6px;font-weight:bold;color:#0f172a;">Tu calificación: ${overallStars} ${check.overall}/5</p>` +
          `<table style="border-collapse:collapse;font-size:13px;">${summaryRowsHtml}</table></div>`;
        const summaryText = `Tu calificación: ${check.overall}/5 (${crit.map((c) => `${c.label} ${Number(check.values[c.key] ?? 0)}`).join(", ")}).`;
        // Derecho de réplica/rectificación PERMANENTE (Ley 1581 de 2012). Las 48 h
        // son una ventana sugerida para responder pronto, NO un plazo que extinga
        // el derecho. No prometemos funciones inexistentes ("acuerdo de mejora").
        const habeasNote =
          `<p style="color:#64748b;font-size:12px;">Como titular de tus datos tienes derecho de réplica y ` +
          `rectificación (Ley 1581 de 2012); permanece disponible mientras exista la calificación. ` +
          `Conforme a la política de evaluación de ArriendoSeguro: calificación privada, estructurada, sin listas ` +
          `negras ni búsqueda pública.</p>`;
        const replyBtn = link.startsWith("http")
          ? `<p><a href="${link}" style="display:inline-block;background:#5646E5;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Ver mi calificación y responder</a></p>`
          : "";
        const html = isLow
          ? `<p>Hola,</p>` +
            `<p>Recibiste una <strong>calificación baja</strong> en ${lowLabels} de parte de la otra parte de tu arriendo ` +
            `(calificación estructurada, solo estrellas). Es privada: nadie puede consultarla por tu cédula.</p>` +
            summaryHtml +
            `<p>Puedes ejercer tu <strong>derecho de réplica</strong> desde tu expediente. Te sugerimos hacerlo dentro de las ` +
            `próximas <strong>${REPLICA_WINDOW_HOURS} horas</strong> para que tu versión quede registrada pronto; ` +
            `este derecho permanece disponible siempre.</p>` +
            replyBtn +
            habeasNote
          : `<p>Hola,</p>` +
            `<p>La otra parte de tu arriendo registró una <strong>calificación estructurada</strong> de la experiencia ` +
            `(solo estrellas, sin comentarios de texto). Es privada: nadie puede consultarla por tu cédula.</p>` +
            summaryHtml +
            `<p>Tienes <strong>derecho de réplica</strong>: puedes responder desde tu expediente.</p>` +
            replyBtn +
            habeasNote;
        await sendEmail({
          to: subjectEmail,
          subject: isLow
            ? "Recibiste una calificación baja — puedes ejercer tu derecho de réplica"
            : "Recibiste una calificación de tu arriendo — ArriendoSeguro",
          html,
          text: isLow
            ? `Recibiste una calificación baja en ${lowLabels}. ${summaryText} Puedes ejercer tu derecho de réplica: ${link}. Te sugerimos hacerlo dentro de ${REPLICA_WINDOW_HOURS} horas, aunque este derecho (Ley 1581 de 2012) permanece disponible siempre.`
            : `La otra parte calificó la experiencia de tu arriendo. ${summaryText} Puedes ver y responder aquí: ${link}`,
          templateCode: isLow ? "reputationLowRatingEmail" : "reputationReviewReceivedEmail",
          relatedEntityType: "contract",
          relatedEntityId: contractId,
        });

        // Complemento al CELULAR (WhatsApp): SIEMPRE que haya celular, con el
        // resumen de la calificación y el enlace directo para ver/responder.
        // Solo sale si el interruptor maestro de WhatsApp está encendido.
        if (subjectPhone) {
          const waMsg = isLow
            ? `Recibiste una calificación baja en tu arriendo. ${summaryText} Puedes ejercer tu derecho de réplica aquí: ${link} (te sugerimos dentro de ${REPLICA_WINDOW_HOURS} h).`
            : `La otra parte calificó tu arriendo. ${summaryText} Míralo y responde aquí: ${link}`;
          await sendPhoneNotice({
            to: subjectPhone,
            message: waMsg,
            templateCode: "reputationLowRatingWa",
            relatedEntityType: "contract",
            relatedEntityId: contractId,
          });
        }
        auditEvent("reputation_review_notified", { contractId, direction, low: isLow });
      } catch (mailErr) {
        await logServerError("reputation/notify", mailErr);
      }
    }

    return NextResponse.json({ success: true, overall: check.overall, updated: existed });
  } catch (err) {
    await logServerError("reputation/submit", err);
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo guardar la calificación." }] },
      { status: 500 },
    );
  }
}
