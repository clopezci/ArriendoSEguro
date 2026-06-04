import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import {
  REFERRAL_CODES_COLLECTION,
  REFERRALS_COLLECTION,
  canRegisterReferral,
  normalizeReferralCode,
} from "@/domain/referrals/referrals";

export const runtime = "nodejs";

/**
 * El invitado registra su referencia con el código del invitador. Queda en
 * estado `pending` hasta que el fundador la apruebe en `/admin`. Idempotente:
 * si ya existe una referencia para esta cuenta, no la duplica.
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }

  const code = normalizeReferralCode(String((body as { code?: unknown })?.code ?? ""));

  // ¿Ya tiene referencia esta cuenta? (doc id = uid del referido)
  const mineRef = firestore.collection(REFERRALS_COLLECTION).doc(auth.user.uid);
  const mineSnap = await mineRef.get();
  if (mineSnap.exists) {
    return NextResponse.json({ success: true, status: (mineSnap.data() as { status?: string }).status ?? "pending", already: true });
  }

  // Resuelve el invitador a partir del código.
  let referrerUid: string | null = null;
  let referrerEmail: string | null = null;
  if (code) {
    const codeSnap = await firestore.collection(REFERRAL_CODES_COLLECTION).doc(code).get();
    if (codeSnap.exists) {
      const d = codeSnap.data() as { ownerUid?: string; ownerEmail?: string };
      referrerUid = d.ownerUid ?? null;
      referrerEmail = d.ownerEmail ?? null;
    }
  }

  const gate = canRegisterReferral({
    code,
    referrerUid,
    referredUid: auth.user.uid,
    alreadyReferred: false,
  });
  if (!gate.ok) {
    return NextResponse.json({ success: false, errors: [{ field: "code", message: gate.reason }] }, { status: 422 });
  }

  await mineRef.set({
    code,
    referrerUid,
    referrerEmail,
    referredUid: auth.user.uid,
    referredEmail: auth.user.email,
    status: "pending",
    createdAt: new Date().toISOString(),
    createdAtServer: FieldValue.serverTimestamp(),
  });

  await auditPlatformPaymentEvent(firestore, "referral_registered", {
    code,
    referrerUid,
    referredUid: auth.user.uid,
  });

  return NextResponse.json({ success: true, status: "pending" });
}
