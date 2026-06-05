import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { REFERRALS_COLLECTION } from "@/domain/referrals/referrals";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

/**
 * Marca al usuario autenticado como **referido calificado** SOLO si usó la app
 * de verdad: el servidor verifica que existe una versión de contrato creada por
 * él (como arrendador) antes de calificar. Así un referido no cuenta por solo
 * registrarse; debe haber generado un contrato real. Idempotente.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  // ¿A este usuario lo refirieron? (doc id = su uid)
  const ref = firestore.collection(REFERRALS_COLLECTION).doc(auth.user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ success: true, qualified: false, reason: "no_referral" });
  }
  if ((snap.data() as { qualified?: boolean }).qualified === true) {
    return NextResponse.json({ success: true, qualified: true, already: true });
  }

  // Verificación de uso real: existe una versión de contrato con este usuario
  // como arrendador (creador). Evita calificar por registro/correos falsos.
  const usage = await firestore
    .collection("contract_versions")
    .where("contractPayload.landlord.email", "==", auth.user.email)
    .limit(1)
    .get()
    .catch(() => null);

  const usedApp = Boolean(usage && !usage.empty);
  if (!usedApp) {
    return NextResponse.json({ success: true, qualified: false, reason: "no_real_usage" });
  }

  await ref.set({ qualified: true, qualifiedAt: new Date().toISOString(), qualifiedAtServer: FieldValue.serverTimestamp() }, { merge: true });
  auditEvent("referral_qualified", { referredUid: auth.user.uid });
  return NextResponse.json({ success: true, qualified: true });
}
