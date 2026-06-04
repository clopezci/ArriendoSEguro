import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import {
  PROPERTY_DOC_TYPES,
  PROPERTY_DOC_MAX_BYTES,
  PROPERTY_DOC_MAX_PER_TYPE,
  assertValidPropertyDocGsPath,
  type PropertyDocType,
} from "@/domain/property-documents/property-documents";

export const runtime = "nodejs";

type Err = { success: false; errors: { field: string; message: string }[] };

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  docType: z.enum(PROPERTY_DOC_TYPES),
  storagePath: z.string().min(8),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
  originalFilename: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) {
      return NextResponse.json<Err>({ success: false, errors: [{ field: "server", message: "Storage no configurado." }] }, { status: 503 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<Err>({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json<Err>(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "body", message: i.message })) },
        { status: 422 },
      );
    }
    const body = parsed.data;

    const participant = await requireContractParticipant(request, firestore, body.contractId, {
      kind: "by_version",
      contractVersionId: body.contractVersionId,
    });
    if (!participant.ok) return participant.response;
    if (participant.role !== "landlord") {
      return NextResponse.json<Err>({ success: false, errors: [{ field: "auth", message: "Solo el arrendador puede registrar documentos de propiedad." }] }, { status: 403 });
    }

    const pathOk = assertValidPropertyDocGsPath(body.storagePath.trim(), {
      expectedBucket: bucketName,
      contractId: body.contractId,
      docType: body.docType as PropertyDocType,
    });
    if (!pathOk) {
      return NextResponse.json<Err>({ success: false, errors: [{ field: "storagePath", message: "Ruta no válida para este contrato/tipo." }] }, { status: 422 });
    }

    const col = firestore.collection("contracts").doc(body.contractId).collection("property_documents");
    const dup = await col.where("storagePath", "==", body.storagePath.trim()).limit(1).get();
    if (!dup.empty) {
      return NextResponse.json<Err>({ success: false, errors: [{ field: "storagePath", message: "Este archivo ya fue registrado." }] }, { status: 422 });
    }
    const activeOfType = await col
      .where("contractVersionId", "==", body.contractVersionId)
      .where("docType", "==", body.docType)
      .where("voided", "==", false)
      .get();
    if (activeOfType.size >= PROPERTY_DOC_MAX_PER_TYPE) {
      return NextResponse.json<Err>({ success: false, errors: [{ field: "docType", message: `Máximo ${PROPERTY_DOC_MAX_PER_TYPE} archivos por tipo.` }] }, { status: 422 });
    }

    // Verifica el archivo en Storage.
    const file = getStorage().bucket(bucketName).file(pathOk.objectPath);
    let metaSize = 0;
    try {
      const [meta] = await file.getMetadata();
      metaSize = Number(meta.size ?? 0);
      if (!Number.isFinite(metaSize) || metaSize <= 0) throw new Error("vacío");
    } catch {
      return NextResponse.json<Err>({ success: false, errors: [{ field: "storagePath", message: "No encontramos el archivo en Storage." }] }, { status: 422 });
    }
    if (metaSize > PROPERTY_DOC_MAX_BYTES || Math.abs(metaSize - body.sizeBytes) > Math.max(512, metaSize * 0.02)) {
      return NextResponse.json<Err>({ success: false, errors: [{ field: "sizeBytes", message: "El tamaño no coincide con el archivo subido." }] }, { status: 422 });
    }

    const now = new Date().toISOString();
    const ref = col.doc();
    await ref.set({
      contractId: body.contractId,
      contractVersionId: body.contractVersionId,
      docType: body.docType,
      storagePath: body.storagePath.trim(),
      contentType: body.contentType,
      sizeBytes: metaSize,
      originalFilename: body.originalFilename.trim(),
      uploadedAt: now,
      uploadedByUid: participant.user.uid,
      voided: false,
      createdAtServer: FieldValue.serverTimestamp(),
    });

    auditEvent("property_document_uploaded", { contractId: body.contractId, docType: body.docType, docId: ref.id });
    return NextResponse.json({ success: true, documentId: ref.id });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("property-documents/confirm", err);
    return NextResponse.json<Err>({ success: false, errors: [{ field: "server", message: "No se pudo registrar el documento." }] }, { status: 500 });
  }
}
