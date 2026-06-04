import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import {
  REFERRAL_CONFIG_COLLECTION,
  REFERRAL_CONFIG_DOC_ID,
  MAX_REFERRAL_DISCOUNT_PERCENT,
  resolveReferralConfig,
} from "@/domain/referrals/referrals";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const snap = await firestore.collection(REFERRAL_CONFIG_COLLECTION).doc(REFERRAL_CONFIG_DOC_ID).get();
  const config = resolveReferralConfig(snap.exists ? snap.data() : undefined);
  return NextResponse.json({ success: true, config });
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  discountPercent: z.number().int().min(0).max(MAX_REFERRAL_DISCOUNT_PERCENT).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    updatedAt: now,
    updatedAtServer: FieldValue.serverTimestamp(),
    updatedByEmail: auth.user.email,
  };
  if (typeof parsed.data.enabled === "boolean") update.enabled = parsed.data.enabled;
  if (typeof parsed.data.discountPercent === "number") update.discountPercent = parsed.data.discountPercent;

  await firestore.collection(REFERRAL_CONFIG_COLLECTION).doc(REFERRAL_CONFIG_DOC_ID).set(update, { merge: true });

  const snap = await firestore.collection(REFERRAL_CONFIG_COLLECTION).doc(REFERRAL_CONFIG_DOC_ID).get();
  const config = resolveReferralConfig(snap.data());
  await auditPlatformPaymentEvent(firestore, "referral_config_updated", {
    enabled: config.enabled,
    discountPercent: config.discountPercent,
  });
  return NextResponse.json({ success: true, config });
}
