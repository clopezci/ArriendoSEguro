import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { isReputationDirectoryEnabled } from "@/domain/reputation/directoryFlags";
import { lookupDirectory } from "@/lib/reputation/directory-store";
import { normalizeEmail, subjectKeyFromEmail } from "@/lib/reputation/aggregate-store";

export const runtime = "nodejs";

/**
 * Consulta el agregado de reputación de un titular por su correo. Exige usuario
 * autenticado (no público) y solo devuelve datos si el titular autorizó opt-in.
 * Cada consulta queda auditada (quién consultó a quién) como evidencia.
 */
export async function GET(request: Request) {
  if (!isReputationDirectoryEnabled()) {
    return NextResponse.json({ success: false, errors: [{ field: "feature", message: "Directorio no disponible." }] }, { status: 404 });
  }
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const subjectEmail = normalizeEmail(new URL(request.url).searchParams.get("subjectEmail") ?? "");
  if (!subjectEmail) {
    return NextResponse.json({ success: false, errors: [{ field: "subjectEmail", message: "Falta el correo del titular." }] }, { status: 422 });
  }

  const result = await lookupDirectory(firestore, subjectEmail);
  auditEvent("reputation_directory_lookup", {
    viewerUid: auth.user.uid,
    subjectKey: subjectKeyFromEmail(subjectEmail),
    authorized: result.authorized,
  });
  if (!result.authorized) {
    return NextResponse.json({ success: true, authorized: false });
  }
  return NextResponse.json({ success: true, authorized: true, subjectEmail: result.subjectEmail, aggregate: result.aggregate });
}
