import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit";
import { deleteSupportRequestSchema } from "@/domain/codebtor-supports/support-schema";
import { parseGsUri } from "@/domain/codebtor-supports/storage-path";
import { codebtorSupportsCollection, type CodebtorSupportDoc } from "@/domain/codebtor-supports/firestore-supports";

export const runtime = "nodejs";

type Err = { success: false; errors: { field: string; message: string }[] };

export async function POST(request: Request) {
  try {
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

    const raw = await request.text();
    const json = JSON.parse(raw) as unknown;
    const parsed = deleteSupportRequestSchema.safeParse(json);
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
          errors: [{ field: "auth", message: "Solo el arrendador puede eliminar soportes del codeudor." }],
        },
        { status: 403 },
      );
    }

    const ref = codebtorSupportsCollection(firestore, body.contractId).doc(body.supportId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "supportId", message: "Soporte no encontrado." }] },
        { status: 404 },
      );
    }

    const row = snap.data() as Partial<CodebtorSupportDoc>;
    if (row.contractVersionId !== body.contractVersionId) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "supportId", message: "El soporte no corresponde a esta versión." }] },
        { status: 422 },
      );
    }
    if (row.voided) {
      return NextResponse.json({ success: true, alreadyVoided: true });
    }

    const gs = parseGsUri(row.storagePath ?? "");
    if (gs && gs.bucket === bucketName) {
      try {
        await getStorage().bucket(bucketName).file(gs.objectPath).delete({ ignoreNotFound: true });
      } catch {
        // Continuamos con la baja lógica aunque falle el borrado físico.
      }
    }

    await ref.set(
      {
        voided: true,
        voidedAt: new Date().toISOString(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    auditEvent("codebtor_support_deleted", {
      contractId: body.contractId,
      contractVersionId: body.contractVersionId,
      supportId: body.supportId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("codebtor-supports/delete", err);
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo eliminar el soporte." }] },
      { status: 500 },
    );
  }
}
