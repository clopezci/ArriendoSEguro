import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { loadCurrentContractContext, requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";
import {
  REPUTATION_DIRECTIONS,
  directionForRaterRole,
  validateRatings,
  type ReputationDirection,
} from "@/domain/reputation/criteria";
import {
  recomputeAggregateForSubject,
  runAntifraudOnSubmit,
} from "@/lib/reputation/aggregate-store";
import { sendEmail } from "@/services/email/sendEmail";

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

    const subjectEmail = (
      direction === "landlord_to_tenant"
        ? ctx.contractPayload?.tenant?.email
        : ctx.contractPayload?.landlord?.email
    )
      ?.trim()
      .toLowerCase() ?? null;
    const subjectRole = direction === "landlord_to_tenant" ? "tenant" : "landlord";

    const now = new Date().toISOString();
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
        const html =
          `<p>Hola,</p>` +
          `<p>La otra parte de tu arriendo registró una <strong>calificación estructurada</strong> de la experiencia ` +
          `(solo estrellas, sin comentarios de texto). Es privada: nadie puede consultarla por tu cédula.</p>` +
          `<p>Tienes <strong>derecho de réplica</strong>: puedes responder desde tu expediente.</p>` +
          (link.startsWith("http") ? `<p><a href="${link}">Ver la calificación y responder</a></p>` : "") +
          `<p style="color:#64748b;font-size:12px;">Conforme a la política de evaluación de ArriendoSeguro. No hay listas negras ni búsqueda pública.</p>`;
        await sendEmail({
          to: subjectEmail,
          subject: "Recibiste una calificación de tu arriendo — ArriendoSeguro",
          html,
          text: "La otra parte calificó la experiencia de tu arriendo. Tienes derecho de réplica desde tu expediente en ArriendoSeguro.",
          templateCode: "reputationReviewReceivedEmail",
          relatedEntityType: "contract",
          relatedEntityId: contractId,
        });
        auditEvent("reputation_review_notified", { contractId, direction });
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
