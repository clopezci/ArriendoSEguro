import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { resolveCertificate } from "@/lib/reputation/certificate-store";

export const runtime = "nodejs";

/**
 * Abre un certificado por token. **Exige usuario autenticado** (solo usuarios de
 * la app; no hay consulta pública). Devuelve solo el agregado del titular.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "Falta el token." }] }, { status: 422 });
  }
  const result = await resolveCertificate(firestore, token);
  if (!result.ok) {
    return NextResponse.json({ success: true, valid: false, reason: result.reason });
  }
  auditEvent("reputation_certificate_viewed", { viewerUid: auth.user.uid });
  return NextResponse.json({
    success: true,
    valid: true,
    subjectEmail: result.subjectEmail,
    aggregate: result.aggregate,
  });
}
