import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { PARTY_INVITE_SUPPORTS_COLLECTION } from "@/domain/party-invite/inviteSupports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El DUEÑO (autenticado) lista los documentos que subieron sus invitados
 * (inquilino/codeudor) para un borrador. Filtra por inviterUid = dueño.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const url = new URL(request.url);
  const contractDraftId = url.searchParams.get("contractDraftId") ?? "";
  const role = url.searchParams.get("role") ?? "";
  const slotParam = url.searchParams.get("codebtorSlot");
  const slot = slotParam == null || slotParam === "" ? null : Math.max(0, Math.floor(Number(slotParam) || 0));
  if (!contractDraftId) return NextResponse.json({ success: false, errors: [{ field: "query", message: "Falta el borrador." }] }, { status: 422 });

  let q = firestore
    .collection(PARTY_INVITE_SUPPORTS_COLLECTION)
    .where("contractDraftId", "==", contractDraftId)
    .where("inviterUid", "==", auth.user.uid);
  if (role === "tenant" || role === "solidaryCoDebtor") q = q.where("role", "==", role);
  const snap = await q.limit(100).get();

  const supports = snap.docs
    .map((d) => {
      const x = d.data() as { id?: string; role?: string; fileName?: string; contentType?: string; sizeBytes?: number; uploadedAt?: string; uploadedByName?: string; codebtorSlot?: number };
      return {
        id: x.id ?? d.id,
        role: x.role ?? "",
        codebtorSlot: x.codebtorSlot ?? 0,
        fileName: x.fileName ?? "documento",
        contentType: x.contentType ?? "",
        sizeBytes: x.sizeBytes ?? 0,
        uploadedAt: x.uploadedAt ?? "",
        uploadedByName: x.uploadedByName ?? "",
      };
    })
    // Si se pide un slot específico (codeudor N), filtramos por él.
    .filter((s) => slot == null || s.codebtorSlot === slot)
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));

  return NextResponse.json({ success: true, supports });
}
