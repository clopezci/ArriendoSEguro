import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import {
  PROPERTY_DOC_TYPES,
  PROPERTY_DOC_MAX_BYTES,
  PROPERTY_DOC_ALLOWED_CONTENT_TYPES,
  propertyDocObjectPath,
  type PropertyDocType,
} from "@/domain/property-documents/property-documents";

export const runtime = "nodejs";

type Err = { success: false; errors: { field: string; message: string }[] };

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  docType: z.enum(PROPERTY_DOC_TYPES),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(PROPERTY_DOC_MAX_BYTES),
});

export async function POST(request: Request) {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "server", message: "Firebase Storage no está configurado (FIREBASE_STORAGE_BUCKET)." }] },
        { status: 503 },
      );
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

    if (!PROPERTY_DOC_ALLOWED_CONTENT_TYPES.includes(body.contentType)) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "contentType", message: "El documento debe ser PDF, JPG, PNG o WEBP." }] },
        { status: 422 },
      );
    }

    const participant = await requireContractParticipant(request, firestore, body.contractId, {
      kind: "by_version",
      contractVersionId: body.contractVersionId,
    });
    if (!participant.ok) return participant.response;
    if (participant.role !== "landlord") {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "auth", message: "Solo el arrendador (dueño/apoderado) puede subir documentos de propiedad." }] },
        { status: 403 },
      );
    }

    const stamp = Date.now();
    const objectPath = propertyDocObjectPath(body.contractId, body.docType as PropertyDocType, stamp, body.filename);
    const file = getStorage().bucket(bucketName).file(objectPath);
    const expires = Date.now() + 1000 * 60 * 15;
    const [uploadUrl] = await file.getSignedUrl({ version: "v4", action: "write", expires, contentType: body.contentType });

    auditEvent("property_document_upload_url_issued", { contractId: body.contractId, docType: body.docType });
    return NextResponse.json({
      success: true,
      uploadUrl,
      storagePath: `gs://${bucketName}/${objectPath}`,
      expiresAt: new Date(expires).toISOString(),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("property-documents/upload-url", err);
    return NextResponse.json<Err>({ success: false, errors: [{ field: "server", message: "No se pudo generar la URL de subida." }] }, { status: 500 });
  }
}
