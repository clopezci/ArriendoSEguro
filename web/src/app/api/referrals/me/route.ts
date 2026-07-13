import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { appConfig } from "@/lib/config";
import {
  REFERRAL_CODES_COLLECTION,
  REFERRALS_COLLECTION,
  REFERRAL_CONFIG_COLLECTION,
  REFERRAL_CONFIG_DOC_ID,
  QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK,
  SIGNATURE_UNLOCK_MICRO_FEE_COP,
  resolveReferralConfig,
  signatureUnlockedByReferrals,
  type ReferralStatus,
} from "@/domain/referrals/referrals";

export const runtime = "nodejs";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I para evitar confusión
const CODE_LENGTH = 8;

function makeCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Devuelve el código del usuario (creándolo si no existe). */
async function ensureUserCode(firestore: Firestore, uid: string, email: string): Promise<string> {
  const existing = await firestore
    .collection(REFERRAL_CODES_COLLECTION)
    .where("ownerUid", "==", uid)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0].id;

  // Genera un código único (reintenta ante colisión, muy improbable).
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = makeCode();
    const ref = firestore.collection(REFERRAL_CODES_COLLECTION).doc(code);
    const snap = await ref.get();
    if (snap.exists) continue;
    await ref.set({
      ownerUid: uid,
      ownerEmail: email,
      createdAt: new Date().toISOString(),
      createdAtServer: FieldValue.serverTimestamp(),
    });
    return code;
  }
  throw new Error("No se pudo generar un código único.");
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  const code = await ensureUserCode(firestore, auth.user.uid, auth.user.email);

  // Conteo de a quiénes referí.
  const myReferralsSnap = await firestore
    .collection(REFERRALS_COLLECTION)
    .where("referrerUid", "==", auth.user.uid)
    .get();
  let approvedCount = 0;
  let pendingCount = 0;
  let qualifiedCount = 0;
  const maskEmail = (v: string) => {
    const at = (v ?? "").indexOf("@");
    if (at <= 1) return "***";
    return `${v[0]}${v[1] ?? ""}***${v.slice(at)}`;
  };
  const referrals: Array<{ email: string; qualified: boolean; status: ReferralStatus }> = [];
  for (const d of myReferralsSnap.docs) {
    const data = d.data() as { status?: ReferralStatus; qualified?: boolean; referredEmail?: string };
    if (data.status === "approved") approvedCount += 1;
    else if (data.status === "pending") pendingCount += 1;
    if (data.qualified === true) qualifiedCount += 1;
    referrals.push({ email: maskEmail(data.referredEmail ?? ""), qualified: data.qualified === true, status: data.status ?? "pending" });
  }
  // Ordena: primero los que ya usaron la app.
  referrals.sort((a, b) => Number(b.qualified) - Number(a.qualified));
  // Cada 3 referidos que usan la app = 1 contrato gratis (con firma incluida).
  const freeContractsEarned = Math.floor(qualifiedCount / QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK);
  const toNextFree = QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK - (qualifiedCount % QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK);

  // ¿A mí me refirieron? (doc id = mi uid)
  const mineSnap = await firestore.collection(REFERRALS_COLLECTION).doc(auth.user.uid).get();
  const myReferralStatus = mineSnap.exists
    ? ((mineSnap.data() as { status?: ReferralStatus }).status ?? "pending")
    : null;

  const configSnap = await firestore
    .collection(REFERRAL_CONFIG_COLLECTION)
    .doc(REFERRAL_CONFIG_DOC_ID)
    .get();
  const config = resolveReferralConfig(configSnap.exists ? configSnap.data() : undefined);

  const base = appConfig.publicUrl.replace(/\/$/, "");
  return NextResponse.json({
    success: true,
    code,
    link: `${base}/?ref=${code}`,
    referredCount: myReferralsSnap.size,
    approvedCount,
    pendingCount,
    qualifiedCount,
    referrals,
    freeContract: {
      required: QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK,
      qualified: qualifiedCount,
      earned: freeContractsEarned,
      toNext: freeContractsEarned > 0 && qualifiedCount % QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK === 0 ? QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK : toNextFree,
    },
    signatureUnlock: {
      required: QUALIFIED_REFERRALS_FOR_SIGNATURE_UNLOCK,
      qualified: qualifiedCount,
      unlocked: signatureUnlockedByReferrals(qualifiedCount),
      microFeeCop: SIGNATURE_UNLOCK_MICRO_FEE_COP,
    },
    myReferralStatus,
    program: { enabled: config.enabled, discountPercent: config.discountPercent },
  });
}
