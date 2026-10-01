import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminBase } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { confirmAdminMfaEnroll } from "@/lib/admin/adminMfa";

export const runtime = "nodejs";

const schema = z.object({ code: z.string().trim().min(6).max(10) });

/** POST /api/admin/mfa/confirm — confirma el enrolamiento con un código del
 * autenticador. Devuelve los códigos de respaldo UNA sola vez. */
export async function POST(request: Request) {
  const gate = await requireInternalAdminBase(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, errors: [{ field: "code", message: "Código inválido." }] }, { status: 422 });

  const res = await confirmAdminMfaEnroll(firestore, gate.user.uid, parsed.data.code);
  if (!res.ok) {
    const msg = res.error === "invalid_code" ? "El código no coincide. Verifica la hora de tu teléfono e intenta de nuevo." : "No se pudo confirmar el enrolamiento.";
    return NextResponse.json({ success: false, errors: [{ field: "code", message: msg }] }, { status: 422 });
  }
  return NextResponse.json({ success: true, backupCodes: res.backupCodes });
}
