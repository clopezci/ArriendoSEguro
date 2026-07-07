import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  getResolvedAdsConfig,
  ADS_COLLECTION,
  ADS_DOC_ID,
} from "@/domain/ads/ads-config";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";

export const runtime = "nodejs";

const patchSchema = z.object({
  mode: z.enum(["house", "adsense", "off"]),
  adClient: z.string().trim().max(60).optional(),
  slots: z.record(z.string(), z.string().trim().max(40)).optional(),
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

  const resolved = await getResolvedAdsConfig(firestore);
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

  // Limpia slots vacíos.
  const slots: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.data.slots ?? {})) {
    const val = String(v ?? "").trim();
    if (val) slots[k] = val;
  }

  const now = new Date().toISOString();
  await firestore.collection(ADS_COLLECTION).doc(ADS_DOC_ID).set(
    {
      mode: parsed.data.mode,
      adClient: parsed.data.adClient?.trim() || null,
      slots,
      updatedAt: now,
      updatedAtServer: FieldValue.serverTimestamp(),
      updatedByEmail: auth.user.email.trim().toLowerCase(),
    },
    { merge: true },
  );

  const resolved = await getResolvedAdsConfig(firestore);
  await auditPlatformPaymentEvent(firestore, "admin_ads_config_updated", {
    mode: resolved.mode,
    slots: Object.keys(resolved.slots).length,
  });

  return NextResponse.json({ success: true, resolved });
}
