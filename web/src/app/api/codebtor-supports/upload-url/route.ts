import { NextResponse } from "next/server";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import {
  CODEBTOR_SUPPORT_MAX_PER_TYPE,
  uploadUrlRequestSchema,
  safeSupportFilename,
} from "@/domain/codebtor-supports/support-schema";
import { countActiveSupportsForType } from "@/domain/codebtor-supports/firestore-supports";

export const runtime = "nodejs";

type Ok = { success: true; uploadUrl: string; storagePath: string; expiresAt: string };
type Err = { success: false; errors: { field: string; message: string }[] };

export async function POST(request: Request) {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [
            {
              field: "server",
              message:
                "Firebase Storage no está configurado (FIREBASE_STORAGE_BUCKET). Activa Storage en la consola y define la variable en Vercel o `.env.local`.",
            },
          ],
        },
        { status: 503 },
      );
    }

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const raw = await request.text();
    const json = JSON.parse(raw) as unknown;
    const parsed = uploadUrlRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "body", message: i.message })),
        },
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
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [{ field: "auth", message: "Solo el arrendador (dueño) puede solicitar carga de soportes del codeudor." }],
        },
        { status: 403 },
      );
    }

    const vSnap = await firestore.collection("contract_versions").doc(body.contractVersionId).get();
    const hasCodebtor = Boolean((vSnap.data() as { hasSolidaryCoDebtor?: boolean } | undefined)?.hasSolidaryCoDebtor);
    if (!hasCodebtor) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [{ field: "contract", message: "Este contrato no tiene codeudor solidario; no aplica la carga de soportes." }],
        },
        { status: 422 },
      );
    }

    const already = await countActiveSupportsForType(
      firestore,
      body.contractId,
      body.contractVersionId,
      body.supportType,
    );
    if (already >= CODEBTOR_SUPPORT_MAX_PER_TYPE) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [
            {
              field: "supportType",
              message: `Ya alcanzaste el máximo de ${CODEBTOR_SUPPORT_MAX_PER_TYPE} archivos para este tipo de soporte en esta versión.`,
            },
          ],
        },
        { status: 422 },
      );
    }

    const stamp = Date.now();
    const storageObjectPath = `contracts/${body.contractId}/codebtor-supports/${body.supportType}/${stamp}-${safeSupportFilename(body.filename)}`;
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(storageObjectPath);

    const expires = Date.now() + 1000 * 60 * 15;
    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires,
      contentType: body.contentType,
    });

    const expiresAt = new Date(expires).toISOString();
    auditEvent("codebtor_support_upload_url_issued", {
      contractId: body.contractId,
      contractVersionId: body.contractVersionId,
      supportType: body.supportType,
      approxBytes: body.sizeBytes,
    });

    return NextResponse.json<Ok>({
      success: true,
      uploadUrl,
      storagePath: `gs://${bucketName}/${storageObjectPath}`,
      expiresAt,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("codebtor-supports/upload-url", err);
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo generar la URL firmada de subida." }] },
      { status: 500 },
    );
  }
}
