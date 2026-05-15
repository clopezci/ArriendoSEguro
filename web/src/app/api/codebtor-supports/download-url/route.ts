import { NextResponse } from "next/server";
import { z } from "zod";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { parseGsUri } from "@/domain/codebtor-supports/storage-path";
import { codebtorSupportsCollection, type CodebtorSupportDoc } from "@/domain/codebtor-supports/firestore-supports";

export const runtime = "nodejs";

const querySchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  supportId: z.string().min(3),
});

type Err = { success: false; errors: { field: string; message: string }[] };

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      contractId: url.searchParams.get("contractId") ?? "",
      contractVersionId: url.searchParams.get("contractVersionId") ?? "",
      supportId: url.searchParams.get("supportId") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "query", message: i.message })),
        },
        { status: 422 },
      );
    }

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
    if (!bucketName) {
      return NextResponse.json<Err>(
        {
          success: false,
          errors: [{ field: "server", message: "Firebase Storage no está configurado (FIREBASE_STORAGE_BUCKET)." }],
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

    const { contractId, contractVersionId, supportId } = parsed.data;
    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!participant.ok) return participant.response;

    const snap = await codebtorSupportsCollection(firestore, contractId).doc(supportId).get();
    if (!snap.exists) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "supportId", message: "Soporte no encontrado." }] },
        { status: 404 },
      );
    }

    const row = snap.data() as Partial<CodebtorSupportDoc>;
    if (row.contractVersionId !== contractVersionId || row.voided) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "supportId", message: "Soporte no disponible." }] },
        { status: 422 },
      );
    }

    const gs = parseGsUri(row.storagePath ?? "");
    if (!gs || gs.bucket !== bucketName) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "server", message: "Ruta de almacenamiento inválida." }] },
        { status: 422 },
      );
    }

    const file = getStorage().bucket(bucketName).file(gs.objectPath);
    const expires = Date.now() + 1000 * 60 * 15;
    const [readUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires,
    });

    auditEvent("codebtor_support_downloaded", {
      contractId,
      contractVersionId,
      supportId,
      role: participant.role,
    });

    return NextResponse.json({
      success: true,
      downloadUrl: readUrl,
      expiresAt: new Date(expires).toISOString(),
      filename: row.originalFilename ?? "soporte",
      contentType: row.contentType ?? "application/octet-stream",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("codebtor-supports/download-url", err);
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo generar la URL de descarga." }] },
      { status: 500 },
    );
  }
}
