import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  getResolvedFreeTier,
  FREE_TIER_COLLECTION,
  FREE_TIER_DOC_ID,
} from "@/domain/platform-payments/free-tier";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";

export const runtime = "nodejs";

const patchSchema = z.object({
  enabled: z.boolean(),
  label: z.string().trim().max(60).optional(),
  message: z.string().trim().max(400).optional(),
});

export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  const resolved = await getResolvedFreeTier(firestore);
  return NextResponse.json({ success: true, resolved });
}

export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  await firestore.collection(FREE_TIER_COLLECTION).doc(FREE_TIER_DOC_ID).set(
    {
      enabled: parsed.data.enabled,
      label: parsed.data.label?.trim() || null,
      message: parsed.data.message?.trim() || null,
      updatedAt: now,
      updatedAtServer: FieldValue.serverTimestamp(),
      updatedByEmail: auth.user.email.trim().toLowerCase(),
    },
    { merge: true },
  );

  const resolved = await getResolvedFreeTier(firestore);
  await auditPlatformPaymentEvent(firestore, "admin_free_tier_updated", {
    enabled: resolved.enabled,
    label: resolved.label,
  });

  return NextResponse.json({ success: true, resolved });
}
