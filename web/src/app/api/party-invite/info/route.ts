import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getInvite } from "@/lib/party-invite/inviteStore";
import { isInviteUsable, partyRoleLabel } from "@/domain/party-invite/partyInvite";
import { checkRateLimit, RATE_LIMIT_RULES, tooManyRequestsJson, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskEmail(v: string): string {
  const at = (v ?? "").indexOf("@");
  if (at <= 1) return "***";
  return `${v[0]}***${v.slice(at)}`;
}

/** Metadatos mínimos de la invitación (sin exponer el resto del contrato). */
export async function GET(request: Request) {
  const rl = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.publicToken);
  if (!rl.ok) {
    const t = tooManyRequestsJson(rl.retryAfterSeconds);
    return NextResponse.json(t.body, { status: 429, headers: t.headers });
  }
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, error: "unavailable" }, { status: 503 });

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const invite = await getInvite(firestore, token);
  if (!invite) return NextResponse.json({ success: true, usable: false, status: "expired" });

  return NextResponse.json({
    success: true,
    usable: isInviteUsable(invite, Date.now()),
    status: invite.status,
    role: invite.role,
    roleLabel: partyRoleLabel(invite.role),
    inviterName: invite.inviterName,
    inviteeName: invite.inviteeName,
    hasEmail: Boolean((invite.inviteeEmail ?? "").trim()),
    emailMasked: maskEmail(invite.inviteeEmail),
  });
}
