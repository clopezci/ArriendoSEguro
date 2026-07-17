import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditEvent } from "@/features/contracts/audit-server";
import { revokeCertificate } from "@/lib/reputation/certificate-store";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10) });

/** El titular revoca uno de sus certificados. */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "Token inválido." }] }, { status: 422 });
  }
  const ok = await revokeCertificate(firestore, auth.user.uid, parsed.data.token);
  if (!ok) {
    return NextResponse.json({ success: false, errors: [{ field: "token", message: "No se encontró el certificado o no es tuyo." }] }, { status: 404 });
  }
  auditEvent("reputation_certificate_revoked", { ownerUid: auth.user.uid });
  return NextResponse.json({ success: true });
}
