import { NextResponse } from "next/server";
import { requireInternalAdminBase } from "@/lib/admin/internal-admin";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { startAdminMfaEnroll } from "@/lib/admin/adminMfa";

export const runtime = "nodejs";

/** POST /api/admin/mfa/enroll — inicia el enrolamiento: genera el secreto y
 * devuelve el otpauth URI (para el QR) + el secreto en texto (entrada manual). */
export async function POST(request: Request) {
  const gate = await requireInternalAdminBase(request);
  if (!gate.ok) return gate.response;
  const firestore = getAdminFirestore();
  if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

  const res = await startAdminMfaEnroll(firestore, gate.user.uid, gate.user.email);
  if (!res.ok) {
    const msg =
      res.error === "secrets_not_configured"
        ? "Falta configurar el cifrado del servidor (AGENCY_SECRETS_KEY)."
        : res.error === "already_enrolled"
          ? "Ya tienes el segundo factor configurado."
          : "No se pudo iniciar el enrolamiento.";
    return NextResponse.json({ success: false, errors: [{ field: "mfa", message: msg }] }, { status: 409 });
  }
  return NextResponse.json({ success: true, otpauthUri: res.otpauthUri, secret: res.secret });
}
