import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import {
  CODEBTOR_SUPPORT_MAX_BYTES,
  CODEBTOR_SUPPORT_MAX_PER_TYPE,
  confirmSupportRequestSchema,
} from "@/domain/codebtor-supports/support-schema";
import { assertValidSupportGsPath } from "@/domain/codebtor-supports/storage-path";
import { supportsCollection, countActiveSupportsForType } from "@/domain/codebtor-supports/firestore-supports";

export const runtime = "nodejs";

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
    const parsed = confirmSupportRequestSchema.safeParse(json);
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

    const canUpload =
      participant.role === "landlord" || (body.party === "tenant" && participant.role === "tenant");
    if (!canUpload) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "auth", message: "No tienes permiso para confirmar estos soportes." }] },
        { status: 403 },
      );
    }

    if (body.party === "codebtor") {
      const vSnap = await firestore.collection("contract_versions").doc(body.contractVersionId).get();
      const hasCodebtor = Boolean((vSnap.data() as { hasSolidaryCoDebtor?: boolean } | undefined)?.hasSolidaryCoDebtor);
      if (!hasCodebtor) {
        return NextResponse.json<Err>(
          { success: false, errors: [{ field: "contract", message: "Esta versión no tiene codeudor solidario." }] },
          { status: 422 },
        );
      }
    }

    const pathOk = assertValidSupportGsPath(body.storagePath, {
      expectedBucket: bucketName,
      contractId: body.contractId,
      party: body.party,
      supportType: body.supportType,
    });
    if (!pathOk) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [{ field: "storagePath", message: "La ruta de almacenamiento no coincide con el contrato o el tipo de soporte." }],
        },
        { status: 422 },
      );
    }

    const dupSnap = await supportsCollection(firestore, body.contractId, body.party)
      .where("storagePath", "==", body.storagePath.trim())
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "storagePath", message: "Este archivo ya fue registrado." }] },
        { status: 422 },
      );
    }

    const already = await countActiveSupportsForType(
      firestore,
      body.contractId,
      body.contractVersionId,
      body.party,
      body.supportType,
    );
    if (already >= CODEBTOR_SUPPORT_MAX_PER_TYPE) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [
            {
              field: "supportType",
              message: `Ya alcanzaste el máximo de ${CODEBTOR_SUPPORT_MAX_PER_TYPE} archivos para este tipo en esta versión.`,
            },
          ],
        },
        { status: 422 },
      );
    }

    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(pathOk.objectPath);
    let metaSize = 0;
    try {
      const [meta] = await file.getMetadata();
      const sz = Number(meta.size ?? 0);
      if (!Number.isFinite(sz) || sz <= 0) {
        return NextResponse.json<Err>(
          { success: false, errors: [{ field: "storagePath", message: "No encontramos el archivo en Storage o está vacío." }] },
          { status: 422 },
        );
      }
      metaSize = sz;
    } catch {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "storagePath", message: "No se pudo verificar el archivo en Storage." }] },
        { status: 422 },
      );
    }

    if (metaSize > CODEBTOR_SUPPORT_MAX_BYTES || Math.abs(metaSize - body.sizeBytes) > Math.max(512, metaSize * 0.02)) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [{ field: "sizeBytes", message: "El tamaño declarado no coincide con el archivo subido." }],
        },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const ref = supportsCollection(firestore, body.contractId, body.party).doc();
    await ref.set({
      contractId: body.contractId,
      contractVersionId: body.contractVersionId,
      party: body.party,
      supportType: body.supportType,
      storagePath: body.storagePath.trim(),
      contentType: body.contentType,
      sizeBytes: metaSize,
      originalFilename: body.originalFilename.trim(),
      uploadedAt: now,
      uploadedByUid: participant.user.uid,
      voided: false,
      createdAtServer: FieldValue.serverTimestamp(),
    });

    auditEvent("codebtor_support_uploaded", {
      contractId: body.contractId,
      contractVersionId: body.contractVersionId,
      supportType: body.supportType,
      approxBytes: metaSize,
      supportDocId: ref.id,
    });

    return NextResponse.json({ success: true, supportId: ref.id, sizeBytes: metaSize });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("codebtor-supports/confirm", err);
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo registrar el soporte." }] },
      { status: 500 },
    );
  }
}
