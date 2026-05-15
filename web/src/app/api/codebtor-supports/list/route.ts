import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import { codebtorSupportsCollection, type CodebtorSupportDoc } from "@/domain/codebtor-supports/firestore-supports";

export const runtime = "nodejs";

const querySchema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
});

type Err = { success: false; errors: { field: string; message: string }[] };

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      contractId: url.searchParams.get("contractId") ?? "",
      contractVersionId: url.searchParams.get("contractVersionId") ?? "",
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

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json<Err>(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }

    const { contractId, contractVersionId } = parsed.data;
    const participant = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!participant.ok) return participant.response;

    const snap = await codebtorSupportsCollection(firestore, contractId).get();
    const items = snap.docs
      .map((d) => {
        const row = d.data() as Partial<CodebtorSupportDoc>;
        if (row.voided) return null;
        if (row.contractVersionId !== contractVersionId) return null;
        return {
          id: d.id,
          supportType: row.supportType,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          originalFilename: row.originalFilename,
          uploadedAt: row.uploadedAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return NextResponse.json({ success: true, supports: items, viewerRole: participant.role });
  } catch {
    return NextResponse.json<Err>(
      { success: false, errors: [{ field: "server", message: "No se pudo listar soportes." }] },
      { status: 500 },
    );
  }
}
