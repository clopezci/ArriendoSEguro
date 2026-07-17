import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { isReputationDirectoryEnabled } from "@/domain/reputation/directoryFlags";
import { getDirectoryAuthorization } from "@/lib/reputation/directory-store";

export const runtime = "nodejs";

/** Estado de la autorización opt-in del usuario autenticado en el directorio. */
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
  const email = (auth.user.email ?? "").trim();
  const authorization = email
    ? await getDirectoryAuthorization(firestore, email)
    : { authorized: false, authorizedAt: null, revokedAt: null, policyVersion: null };
  return NextResponse.json({ success: true, authorization });
}
