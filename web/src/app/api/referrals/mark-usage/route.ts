import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore, getAdminAuth } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { REFERRALS_COLLECTION, QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK } from "@/domain/referrals/referrals";
import { grantManualPlusEntitlement } from "@/domain/platform-payments/manual-grant";
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

  // Recompensa: al llegar a 3 referidos calificados (o cada múltiplo de 3), el
  // que refirió recibe un contrato GRATIS = un entitlement Plus (que ya incluye
  // la firma). Best-effort: si algo falla, NO rompe la calificación del referido.
  let rewardGranted = false;
  try {
    const data = snap.data() as { referrerUid?: string; referrerEmail?: string };
    if (data.referrerUid && data.referrerEmail) {
      const qsnap = await firestore
        .collection(REFERRALS_COLLECTION)
        .where("referrerUid", "==", data.referrerUid)
        .where("qualified", "==", true)
        .get();
      const qualifiedCount = qsnap.size;
      const adminAuth = getAdminAuth();
      if (adminAuth && qualifiedCount > 0 && qualifiedCount % QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK === 0) {
        const res = await grantManualPlusEntitlement(
          { auth: adminAuth, firestore, requestedBy: "referral_reward" },
          { email: data.referrerEmail, validDays: 60, maxContractsAllowed: 1 },
        );
        rewardGranted = res.ok && res.status === "created";
        if (rewardGranted) auditEvent("referral_free_contract_granted", { referrerUid: data.referrerUid, qualifiedCount });
      }
    }
  } catch {
    /* la recompensa es best-effort */
  }

  return NextResponse.json({ success: true, qualified: true, rewardGranted });
}
