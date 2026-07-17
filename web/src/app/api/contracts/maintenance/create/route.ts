import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { validateMaintenanceInput, MAINTENANCE_CATEGORY_LABELS } from "@/domain/maintenance/maintenance";
import { resolveNovedadRecipientEmails } from "@/domain/contracts/novedades/recipients";
import { persistExpedienteAttachment } from "@/domain/contracts/persistExpedienteAttachment";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";
import { sendEmail } from "@/services/email/sendEmail";
import { sendSms } from "@/services/sms/sendSms";
import { auditEvent } from "@/features/contracts/audit-server";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);

type Resp =
  | { success: true; requestId: string }
  | { success: false; errors: { field: string; message: string }[] };

/** Reporta una solicitud de reparación/mantenimiento (cualquier parte del contrato). */
export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<Resp>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const contractId = String(form.get("contractId") ?? "").trim();
    const title = String(form.get("title") ?? "");
    const description = String(form.get("description") ?? "");
    const category = String(form.get("category") ?? "");
    const file = form.get("file");

    if (!contractId) {
      return NextResponse.json<Resp>(
        { success: false, errors: [{ field: "contractId", message: "Falta el contrato." }] },
        { status: 422 },
      );
    }

    const check = validateMaintenanceInput({ title, description, category });
    if (!check.ok) {
      return NextResponse.json<Resp>({ success: false, errors: [{ field: "form", message: check.error }] }, { status: 422 });
    }

    const cSnap = await firestore.collection("contracts").doc(contractId).get();
    if (!cSnap.exists) {
      return NextResponse.json<Resp>(
        { success: false, errors: [{ field: "contractId", message: "Expediente no encontrado." }] },
        { status: 404 },
      );
    }
    const currentVersionId = (cSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId;
    if (!currentVersionId) {
      return NextResponse.json<Resp>(
        { success: false, errors: [{ field: "contract", message: "El expediente no tiene versión actual guardada." }] },
        { status: 422 },
      );
    }

    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId: currentVersionId,
    });
    if (!participant.ok) return participant.response;

    const vSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const vData = vSnap.data() as { contractPayload?: ResidentialLeaseContractInput; hasSolidaryCoDebtor?: boolean } | undefined;
    const payload = vData?.contractPayload;
    const hasCodebtor = Boolean(vData?.hasSolidaryCoDebtor ?? payload?.hasSolidaryCoDebtor);

    const ref = firestore.collection("contracts").doc(contractId).collection("maintenance").doc();
    const requestId = ref.id;
    const now = new Date().toISOString();

    // Foto opcional (solo imagen: reparaciones se documentan con foto).
    let photoPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json<Resp>(
          { success: false, errors: [{ field: "file", message: `La foto supera ${MAX_FILE_BYTES / 1024 / 1024} MB.` }] },
          { status: 413 },
        );
      }
      const mime = (file.type ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
      if (!ALLOWED_MIME.has(mime)) {
        return NextResponse.json<Resp>(
          { success: false, errors: [{ field: "file", message: "La foto debe ser JPG o PNG." }] },
          { status: 422 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = mime === "image/png" ? "png" : "jpg";
      const persisted = await persistExpedienteAttachment({
        bytes: buf,
        storageObjectPath: `contracts/${contractId}/maintenance/${requestId}.${ext}`,
        contentType: mime,
        contractId,
        novedadId: requestId,
      });
      photoPath = persisted.storagePath;
    }

    await ref.set({
      id: requestId,
      contractId,
      contractVersionId: currentVersionId,
      reportedByUid: participant.user.uid,
      reportedByEmail: participant.user.email,
      reportedByRole: participant.role,
      title: check.values.title,
      description: check.values.description,
      category: check.values.category,
      photoPath,
      status: "open",
      rejectionCount: 0,
      responses: [],
      createdAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAt: now,
      resolvedAt: null,
    });

    // Avisar a las otras partes (sobre todo al dueño) por correo y SMS.
    const recipients = resolveNovedadRecipientEmails(payload, hasCodebtor, participant.user.email);
    const catLabel = MAINTENANCE_CATEGORY_LABELS[check.values.category];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const link = appUrl ? `${appUrl}/dashboard/contracts/${contractId}/mantenimiento` : "";
    for (const to of recipients) {
      await sendEmail({
        to,
        subject: `Nueva solicitud de reparación: ${check.values.title}`,
        html:
          `<p>Se registró una <strong>solicitud de reparación</strong> en tu arriendo.</p>` +
          `<ul><li><strong>Asunto:</strong> ${check.values.title}</li><li><strong>Categoría:</strong> ${catLabel}</li></ul>` +
          `<p>${check.values.description}</p>` +
          (link ? `<p><a href="${link}">Ver y responder (aceptar o rechazar)</a></p>` : ""),
        text: `Nueva solicitud de reparación (${catLabel}): ${check.values.title}. ${check.values.description}${link ? ` — Responde aquí: ${link}` : ""}`,
        templateCode: "maintenanceReportedEmail",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
    }
    const authorEmailLc = (participant.user.email ?? "").toLowerCase();
    const phoneTargets = [payload?.landlord, payload?.tenant]
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.phone))
      .filter((p) => (p.email ?? "").toLowerCase() !== authorEmailLc);
    const seen = new Set<string>();
    for (const p of phoneTargets) {
      if (seen.has(p.phone!)) continue;
      seen.add(p.phone!);
      await sendSms({
        to: p.phone!,
        body: `ArriendoSeguro: nueva solicitud de reparación (${catLabel}) en tu arriendo. Revísala y responde en la plataforma.`,
        templateCode: "maintenanceSms",
        relatedEntityType: "contract",
        relatedEntityId: contractId,
      });
    }

    auditEvent("maintenance_reported", { contractId, requestId, category: check.values.category, role: participant.role });
    return NextResponse.json<Resp>({ success: true, requestId });
  } catch (err) {
    await logServerError("maintenance/create", err);
    return NextResponse.json<Resp>(
      { success: false, errors: [{ field: "server", message: "No se pudo registrar la solicitud." }] },
      { status: 500 },
    );
  }
}
