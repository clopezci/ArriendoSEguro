import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { novedadCreateFormSchema } from "@/domain/contracts/novedades/novedadRequestSchema";
import { NOVEDAD_TIPO_LABELS } from "@/domain/contracts/novedades/types";
import { resolveNovedadRecipientEmails } from "@/domain/contracts/novedades/recipients";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";
import { persistExpedienteAttachment } from "@/domain/contracts/persistExpedienteAttachment";
import { sendEmail } from "@/services/email/sendEmail";
import { expedienteNovedadEmail } from "@/services/email/emailTemplates";
import { sendSms } from "@/services/sms/sendSms";
import { auditEvent } from "@/features/contracts/audit-server";
import { shouldBlockForPlus, plusRequiredResponse } from "@/lib/auth/contractPlusGate";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);

/** Índice (0-based) del codeudor a partir del rol, o null si no es codeudor. */
function codebtorIndexFromRole(role: string): number | null {
  if (role === "solidaryCoDebtor") return 0;
  if (role.startsWith("solidaryCoDebtor_")) {
    const n = Number(role.slice("solidaryCoDebtor_".length));
    return Number.isFinite(n) ? n - 1 : null;
  }
  return null;
}

function codebtorAt(payload: ResidentialLeaseContractInput | undefined, index: number) {
  const list = payload?.solidaryCoDebtors;
  if (list && list.length > 0) return list[index];
  return index === 0 ? payload?.solidaryCoDebtor : undefined;
}

function partyLabel(role: string): string {
  if (role === "landlord") return "Arrendador (dueño)";
  if (role === "tenant") return "Arrendatario (inquilino)";
  const idx = codebtorIndexFromRole(role);
  if (idx !== null) return idx === 0 ? "Codeudor solidario" : `Codeudor solidario ${idx + 1}`;
  return role;
}

function authorDisplayName(payload: ResidentialLeaseContractInput | undefined, role: string): string {
  if (role === "landlord") return (payload?.landlord?.fullName ?? "Arrendador").trim() || "Arrendador";
  if (role === "tenant") return (payload?.tenant?.fullName ?? "Arrendatario").trim() || "Arrendatario";
  const idx = codebtorIndexFromRole(role);
  if (idx !== null) return (codebtorAt(payload, idx)?.fullName ?? "Codeudor").trim() || "Codeudor";
  return "Parte del contrato";
}

type PostJson =
  | { success: true; novedadId: string; emailsAttempted: number }
  | { success: false; errors: { field: string; message: string }[] };

export async function POST(request: Request) {
  try {
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<PostJson>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const contractId = String(form.get("contractId") ?? "").trim();
    const tipoRaw = String(form.get("tipo") ?? "").trim();
    const description = String(form.get("description") ?? "");
    const file = form.get("file");

    const parsed = novedadCreateFormSchema.safeParse({
      contractId,
      tipo: tipoRaw,
      description,
    });
    if (!parsed.success) {
      return NextResponse.json<PostJson>(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({
            field: i.path.join(".") || "form",
            message: i.message,
          })),
        },
        { status: 422 },
      );
    }

    const cSnap = await firestore.collection("contracts").doc(parsed.data.contractId).get();
    if (!cSnap.exists) {
      return NextResponse.json<PostJson>(
        { success: false, errors: [{ field: "contractId", message: "Expediente no encontrado." }] },
        { status: 404 },
      );
    }
    const currentVersionId = (cSnap.data() as { currentVersionId?: string } | undefined)?.currentVersionId;
    if (!currentVersionId) {
      return NextResponse.json<PostJson>(
        { success: false, errors: [{ field: "contract", message: "El expediente no tiene versión actual guardada." }] },
        { status: 422 },
      );
    }

    const participant = await requireContractParticipant(request, firestore, parsed.data.contractId, {
      kind: "by_version",
      contractVersionId: currentVersionId,
    });
    if (!participant.ok) return participant.response;

    // Gate de pago: registrar novedades es Plan Plus (posventa).
    if (await shouldBlockForPlus(firestore, participant.user.uid)) {
      return plusRequiredResponse("Registrar novedades del arriendo");
    }

    const vSnap = await firestore.collection("contract_versions").doc(currentVersionId).get();
    const vData = vSnap.data() as {
      contractPayload?: ResidentialLeaseContractInput;
      hasSolidaryCoDebtor?: boolean;
    } | undefined;
    const payload = vData?.contractPayload;
    const hasCodebtor = Boolean(vData?.hasSolidaryCoDebtor ?? payload?.hasSolidaryCoDebtor);

    const novedadRef = firestore
      .collection("contracts")
      .doc(parsed.data.contractId)
      .collection("novedades")
      .doc();
    const novedadId = novedadRef.id;
    const now = new Date().toISOString();

    let attachmentStoragePath: string | undefined;
    let attachmentContentType: string | undefined;
    let attachmentOriginalName: string | undefined;
    let attachmentUrl: string | null | undefined;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json<PostJson>(
          {
            success: false,
            errors: [{ field: "file", message: `El archivo supera el máximo de ${MAX_FILE_BYTES / 1024 / 1024} MB.` }],
          },
          { status: 413 },
        );
      }
      const mime = (file.type ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
      if (!ALLOWED_MIME.has(mime)) {
        return NextResponse.json<PostJson>(
          {
            success: false,
            errors: [{ field: "file", message: "Solo se permiten PDF, JPG o PNG." }],
          },
          { status: 422 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (mime === "application/pdf" && (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-")) {
        return NextResponse.json<PostJson>(
          { success: false, errors: [{ field: "file", message: "El PDF no parece válido." }] },
          { status: 422 },
        );
      }
      const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "pdf";
      const persisted = await persistExpedienteAttachment({
        bytes: buf,
        storageObjectPath: `contracts/${parsed.data.contractId}/novedades/${novedadId}.${ext}`,
        contentType: mime,
        contractId: parsed.data.contractId,
        novedadId,
      });
      attachmentStoragePath = persisted.storagePath;
      attachmentContentType = mime;
      attachmentOriginalName = file.name.slice(0, 200);
      attachmentUrl = persisted.publicUrl;
    }

    const recipients = resolveNovedadRecipientEmails(payload, hasCodebtor, participant.user.email);

    const draftId = (cSnap.data() as { draftId?: string } | undefined)?.draftId;

    await novedadRef.set({
      id: novedadId,
      contractId: parsed.data.contractId,
      contractVersionId: currentVersionId,
      tipo: parsed.data.tipo,
      description: parsed.data.description.trim(),
      createdAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
      authorUserId: participant.user.uid,
      authorEmail: participant.user.email,
      authorRole: participant.role,
      notifiedEmails: recipients,
      attachmentStoragePath: attachmentStoragePath ?? null,
      attachmentContentType: attachmentContentType ?? null,
      attachmentOriginalName: attachmentOriginalName ?? null,
      attachmentUrl: attachmentUrl ?? null,
    });

    const tipoLabel = NOVEDAD_TIPO_LABELS[parsed.data.tipo];
    const authorName = authorDisplayName(payload, participant.role);
    const tpl = expedienteNovedadEmail({
      authorName,
      authorRoleLabel: partyLabel(participant.role),
      tipoLabel,
      description: parsed.data.description.trim(),
      contractId: parsed.data.contractId,
      leaseProcessId: draftId,
      hasAttachment: Boolean(attachmentStoragePath),
    });

    let emailsAttempted = 0;
    for (const to of recipients) {
      emailsAttempted += 1;
      await sendEmail({
        to,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
        templateCode: "expedienteNovedadEmail",
        relatedEntityType: "contract",
        relatedEntityId: parsed.data.contractId,
      });
    }

    // Aviso por SMS a las otras partes (best-effort; mock si no hay proveedor).
    const authorEmailLc = (participant.user.email ?? "").toLowerCase();
    const codebtorPhoneTargets =
      payload?.solidaryCoDebtors && payload.solidaryCoDebtors.length > 0
        ? payload.solidaryCoDebtors
        : hasCodebtor && payload?.solidaryCoDebtor
          ? [payload.solidaryCoDebtor]
          : [];
    const phoneTargets = [payload?.landlord, payload?.tenant, ...codebtorPhoneTargets]
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.phone))
      .filter((p) => (p.email ?? "").toLowerCase() !== authorEmailLc);
    const smsBody = `ArriendoSeguro: ${authorName} registró una novedad (${tipoLabel}) en tu arriendo. Revísala en la plataforma.`;
    const seenPhones = new Set<string>();
    for (const p of phoneTargets) {
      if (seenPhones.has(p.phone)) continue;
      seenPhones.add(p.phone);
      await sendSms({
        to: p.phone,
        body: smsBody,
        templateCode: "expedienteNovedadSms",
        relatedEntityType: "contract",
        relatedEntityId: parsed.data.contractId,
      });
    }

    auditEvent("expediente_novedad_registered", {
      contractId: parsed.data.contractId,
      contractVersionId: currentVersionId,
      novedadId,
      tipo: parsed.data.tipo,
      authorRole: participant.role,
      descriptionLength: parsed.data.description.trim().length,
      recipientsCount: recipients.length,
      hasAttachment: Boolean(attachmentStoragePath),
    });

    return NextResponse.json<PostJson>({ success: true, novedadId, emailsAttempted });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("contracts/novedades POST", err);
    return NextResponse.json<PostJson>(
      { success: false, errors: [{ field: "server", message: "No se pudo registrar la novedad." }] },
      { status: 500 },
    );
  }
}
