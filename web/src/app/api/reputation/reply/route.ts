import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { persistExpedienteAttachment } from "@/domain/contracts/persistExpedienteAttachment";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";
import { REPLICA_REASONS, REPLICA_TEXT_MAX, reviewDirectionAboutRole } from "@/domain/reputation/criteria";

export const runtime = "nodejs";

const REVIEWS_COLLECTION = "reputation_reviews";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);
const EXT_BY_MIME: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

type Err = { success: false; errors: { field: string; message: string }[] };

const schema = z.object({
  contractId: z.string().min(3),
  reason: z.enum(REPLICA_REASONS),
  text: z.string().trim().max(REPLICA_TEXT_MAX).optional().or(z.literal("")),
});

/**
 * Derecho de réplica: la persona calificada puede responder a la calificación
 * que recibió (motivo cerrado + respuesta breve opcional). Solo el sujeto de la
 * calificación (parte del contrato) puede replicar; se valida en servidor.
 */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    // La réplica llega como multipart (para adjuntar un documento de soporte
    // opcional). Retrocompatible con JSON por si algún cliente antiguo lo envía.
    let raw: { contractId?: unknown; reason?: unknown; text?: unknown };
    let file: unknown = null;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      raw = {
        contractId: String(form.get("contractId") ?? ""),
        reason: String(form.get("reason") ?? ""),
        text: form.get("text") ? String(form.get("text")) : undefined,
      };
      file = form.get("file");
    } else {
      raw = (await request.json().catch(() => ({}))) as typeof raw;
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "body", message: "Datos de réplica inválidos." }] },
        { status: 422 },
      );
    }
    const { contractId, reason } = parsed.data;
    const text = (parsed.data.text ?? "").trim();

    const participant = await requireContractParticipant(request, firestore, contractId, { kind: "current" });
    if (!participant.ok) return participant.response;

    // La réplica aplica a la calificación de la que ESTA persona es sujeto.
    const aboutMe = reviewDirectionAboutRole(participant.role);
    if (!aboutMe) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "role", message: "Tu rol no recibe calificaciones que puedas replicar." }] },
        { status: 403 },
      );
    }

    const ref = firestore.collection(REVIEWS_COLLECTION).doc(`${contractId}__${aboutMe}`);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "review", message: "Aún no hay una calificación sobre ti para replicar." }] },
        { status: 409 },
      );
    }

    // Documento de soporte opcional (PDF/JPG/PNG) que respalda la réplica.
    let attachmentPath: string | null = null;
    let attachmentUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json<Err>(
          { success: false, errors: [{ field: "file", message: `El documento supera ${MAX_FILE_BYTES / 1024 / 1024} MB.` }] },
          { status: 413 },
        );
      }
      const mime = (file.type ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
      if (!ALLOWED_MIME.has(mime)) {
        return NextResponse.json<Err>(
          { success: false, errors: [{ field: "file", message: "El documento debe ser PDF, JPG o PNG." }] },
          { status: 422 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = EXT_BY_MIME[mime] ?? "bin";
      const persisted = await persistExpedienteAttachment({
        bytes: buf,
        storageObjectPath: `contracts/${contractId}/reputation-replies/${aboutMe}.${ext}`,
        contentType: mime,
        contractId,
        novedadId: `reputation-reply-${aboutMe}`,
      });
      attachmentPath = persisted.storagePath;
      attachmentUrl = persisted.publicUrl;
    }

    const now = new Date().toISOString();
    await ref.set(
      {
        reply: {
          reason,
          text: text.slice(0, REPLICA_TEXT_MAX),
          byRole: participant.role,
          byUid: participant.user.uid,
          byEmail: participant.user.email,
          attachmentPath,
          attachmentUrl,
          createdAt: now,
          createdAtServer: FieldValue.serverTimestamp(),
        },
        updatedAt: now,
      },
      { merge: true },
    );

    auditEvent("reputation_reply_submitted", { contractId, direction: aboutMe, reason, hasAttachment: Boolean(attachmentPath) });

    return NextResponse.json({ success: true });
  } catch (err) {
    await logServerError("reputation/reply", err);
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo guardar la réplica." }] },
      { status: 500 },
    );
  }
}
