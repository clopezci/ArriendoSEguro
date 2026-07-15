import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import { PARTY_INVITE_SUPPORTS_COLLECTION, type InviteSupportRow } from "@/domain/party-invite/inviteSupports";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El invitado ve la lista de documentos que ya subió (por su token). */
export async function GET(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const invite = await getInvite(firestore, token);
  if (!invite) return NextResponse.json({ success: true, supports: [] });

  const inviteSlot = invite.codebtorSlot ?? 0;
  const snap = await firestore
    .collection(PARTY_INVITE_SUPPORTS_COLLECTION)
    .where("contractDraftId", "==", invite.contractDraftId)
    .where("role", "==", invite.role)
    .limit(50)
    .get();

  const supports: InviteSupportRow[] = snap.docs
    .map((d) => {
      const x = d.data() as { id?: string; fileName?: string; contentType?: string; sizeBytes?: number; uploadedAt?: string; codebtorSlot?: number; docKey?: string };
      return { id: x.id ?? d.id, fileName: x.fileName ?? "documento", contentType: x.contentType ?? "", sizeBytes: x.sizeBytes ?? 0, uploadedAt: x.uploadedAt ?? "", codebtorSlot: x.codebtorSlot ?? 0, docKey: x.docKey };
    })
    .filter((s) => s.codebtorSlot === inviteSlot) // solo los de ESTE codeudor
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));

  return NextResponse.json({ success: true, supports });
}
