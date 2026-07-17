import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { isReputationDirectoryEnabled } from "@/domain/reputation/directoryFlags";
import { setDirectoryAuthorization, getDirectoryAuthorization } from "@/lib/reputation/directory-store";

export const runtime = "nodejs";

const schema = z.object({ authorized: z.boolean() });

/** El titular activa/desactiva (opt-in/revoca) su visibilidad en el directorio. */
export async function POST(request: Request) {
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
  if (!email) {
    return NextResponse.json({ success: false, errors: [{ field: "email", message: "Tu cuenta no tiene correo asociado." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "authorized", message: "Valor inválido." }] }, { status: 422 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");
  await setDirectoryAuthorization(firestore, { uid: auth.user.uid, email, authorized: parsed.data.authorized, ip, userAgent });
  auditEvent("reputation_directory_authorization_set", { uid: auth.user.uid, authorized: parsed.data.authorized });

  const current = await getDirectoryAuthorization(firestore, email);
  return NextResponse.json({ success: true, authorization: current });
}
