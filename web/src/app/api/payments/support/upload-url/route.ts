import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { shouldBlockForPlus, plusRequiredResponse } from "@/lib/auth/contractPlusGate";
import { validatePaymentSupportFile, sanitizeSupportFileName } from "@/domain/payments/supportValidation";

export const runtime = "nodejs";

type Ok = { success: true; uploadUrl: string; storagePath: string; expiresAt: string };
type Err = { success: false; errors: { field: string; message: string }[] };

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive(),
});

/**
 * Genera una URL firmada para subir el **soporte de pago** a Firebase Storage
 * (mismo patrón que los soportes del codeudor). Reemplaza el placeholder que
 * antes solo guardaba una URL `mock://`. Es base del enlace del inquilino (QR).
 */
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
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
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

    if (await shouldBlockForPlus(firestore, participant.user.uid)) {
      return plusRequiredResponse("Cargar soporte de pago");
    }

    // Valida tipo/tamaño con la misma regla del registro de pagos.
    const v = validatePaymentSupportFile({
      supportFileName: body.filename,
      supportFileType: body.contentType,
      supportFileSize: body.sizeBytes,
    });
    if (!v.ok) {
      return NextResponse.json<Err>({ success: false, errors: v.errors }, { status: 422 });
    }

    const stamp = Date.now();
    const storageObjectPath = `contracts/${body.contractId}/payment-supports/${stamp}-${sanitizeSupportFileName(body.filename)}`;
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(storageObjectPath);
    const expires = Date.now() + 1000 * 60 * 15;
    const [uploadUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires,
      contentType: body.contentType,
    });

    auditEvent("payment_support_upload_url_issued", { contractId: body.contractId, approxBytes: body.sizeBytes });
    return NextResponse.json<Ok>({
      success: true,
      uploadUrl,
      storagePath: `gs://${bucketName}/${storageObjectPath}`,
      expiresAt: new Date(expires).toISOString(),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("payments/support/upload-url", err);
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo generar la URL de subida." }] },
      { status: 500 },
    );
  }
}
