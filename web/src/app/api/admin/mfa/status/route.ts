import { NextResponse } from "next/server";
import { requireInternalAdminBase } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAdminMfaStatus } from "@/lib/admin/adminMfa";
import { secretsConfigured } from "@/lib/security/agencySecrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/mfa/status — ¿el admin está enrolado y con sesión MFA vigente? */
export async function GET(request: Request) {
  const gate = await requireInternalAdminBase(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  const status = await getAdminMfaStatus(firestore, gate.user.uid);
  return NextResponse.json({ success: true, ...status, secretsConfigured: secretsConfigured() });
}
