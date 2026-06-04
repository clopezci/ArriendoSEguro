import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  OBSERVABILITY_CONFIG_COLLECTION,
  OBSERVABILITY_CONFIG_DOC_ID,
  resolveObservabilityConfig,
} from "@/domain/observability/observabilityConfig";

export const runtime = "nodejs";

function firestoreUnavailable() {
  return NextResponse.json(
    { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const snap = await firestore.collection(OBSERVABILITY_CONFIG_COLLECTION).doc(OBSERVABILITY_CONFIG_DOC_ID).get();
  return NextResponse.json({ success: true, config: resolveObservabilityConfig(snap.exists ? snap.data() : undefined) });
}

const patchSchema = z.object({
  errorAlertEnabled: z.boolean().optional(),
  errorAlertThreshold: z.number().int().min(1).max(1000).optional(),
  errorAlertWindowMinutes: z.number().int().min(5).max(1440).optional(),
  errorAlertCooldownMinutes: z.number().int().min(15).max(10080).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireInternalAdmin(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) return firestoreUnavailable();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
    updatedAtServer: FieldValue.serverTimestamp(),
    updatedByEmail: auth.user.email,
  };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) update[k] = v;
  }
  await firestore.collection(OBSERVABILITY_CONFIG_COLLECTION).doc(OBSERVABILITY_CONFIG_DOC_ID).set(update, { merge: true });

  const snap = await firestore.collection(OBSERVABILITY_CONFIG_COLLECTION).doc(OBSERVABILITY_CONFIG_DOC_ID).get();
  return NextResponse.json({ success: true, config: resolveObservabilityConfig(snap.data()) });
}
