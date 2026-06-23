import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { PARTY_INVITES_COLLECTION, isPartyRole } from "@/domain/party-invite/partyInvite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Estado de la invitación para el **dueño** (autenticado): si el tercero ya
 * completó sus datos, devuelve la contribución para que el dueño la importe.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const url = new URL(request.url);
  const contractDraftId = url.searchParams.get("contractDraftId") ?? "";
  const role = url.searchParams.get("role") ?? "";
  if (!contractDraftId || !isPartyRole(role)) {
    return NextResponse.json({ success: false, errors: [{ field: "query", message: "Parámetros inválidos." }] }, { status: 422 });
  }

  const snap = await firestore
    .collection(PARTY_INVITES_COLLECTION)
    .where("contractDraftId", "==", contractDraftId)
    .where("role", "==", role)
    .where("inviterUid", "==", auth.user.uid)
    .limit(5)
    .get();

  if (snap.empty) return NextResponse.json({ success: true, invite: null });

  // El más reciente (por createdAt).
  const docs = snap.docs
    .map((d) => d.data() as { status?: string; inviteeEmail?: string; contribution?: unknown; completedAt?: string; createdAt?: string })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const inv = docs[0];

  return NextResponse.json({
    success: true,
    invite: {
      status: inv.status ?? "active",
      inviteeEmail: inv.inviteeEmail ?? "",
      contribution: inv.status === "completed" ? inv.contribution ?? null : null,
      completedAt: inv.completedAt ?? null,
    },
  });
}
