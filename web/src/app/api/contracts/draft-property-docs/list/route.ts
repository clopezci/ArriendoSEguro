import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { DRAFT_PROPERTY_DOCS_COLLECTION, type DraftPropertyDocRow } from "@/domain/contracts/draftPropertyDocs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El DUEÑO lista sus documentos de propiedad de un borrador. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const contractDraftId = new URL(request.url).searchParams.get("contractDraftId") ?? "";
  if (!contractDraftId) return NextResponse.json({ success: true, docs: [] });

  const snap = await firestore
    .collection(DRAFT_PROPERTY_DOCS_COLLECTION)
    .where("contractDraftId", "==", contractDraftId)
    .where("ownerUid", "==", auth.user.uid)
    .limit(50)
    .get();

  const docs: DraftPropertyDocRow[] = snap.docs
    .map((d) => {
      const x = d.data() as { id?: string; docType?: string; fileName?: string; sizeBytes?: number; uploadedAt?: string };
      return { id: x.id ?? d.id, docType: x.docType ?? "otro", fileName: x.fileName ?? "documento", sizeBytes: x.sizeBytes ?? 0, uploadedAt: x.uploadedAt ?? "" };
    })
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));

  return NextResponse.json({ success: true, docs });
}
