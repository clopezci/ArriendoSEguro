import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireInternalAdmin } from "@/lib/admin/internal-admin";
import {
  getResolvedPlanPlusPricing,
  PLAN_PLUS_CUSTOM_COP_LIMITS,
  PLAN_PLUS_PRICING_COLLECTION,
  PLAN_PLUS_PRICING_DOC_ID,
  type PlanPlusPricingPreset,
} from "@/domain/platform-payments/plan-plus-pricing";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    preset: z.enum(["promo_49900", "list_89900", "custom"]),
    customCheckoutCop: z
      .number()
      .int()
      .min(PLAN_PLUS_CUSTOM_COP_LIMITS.min)
      .max(PLAN_PLUS_CUSTOM_COP_LIMITS.max)
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.preset === "custom" && data.customCheckoutCop == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica el monto en COP cuando eliges “otro”.",
        path: ["customCheckoutCop"],
      });
    }
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

  const ref = firestore.collection(PLAN_PLUS_PRICING_COLLECTION).doc(PLAN_PLUS_PRICING_DOC_ID);
  const snap = await ref.get();
  const raw = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const resolved = await getResolvedPlanPlusPricing(firestore);

  return NextResponse.json({
    success: true,
    stored: snap.exists ? raw : null,
    preset: raw.preset ?? null,
    customCheckoutCop: raw.customCheckoutCop ?? null,
    resolved: {
      checkoutCop: resolved.checkoutCop,
      listCompareCop: resolved.listCompareCop,
      preset: resolved.preset,
    },
    limitsCop: PLAN_PLUS_CUSTOM_COP_LIMITS,
  });
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
    return NextResponse.json(
      { success: false, errors: [{ field: "body", message: "JSON inválido." }] },
      { status: 422 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  const preset = parsed.data.preset as PlanPlusPricingPreset;
  const customCheckoutCop = preset === "custom" ? parsed.data.customCheckoutCop! : null;

  await firestore.collection(PLAN_PLUS_PRICING_COLLECTION).doc(PLAN_PLUS_PRICING_DOC_ID).set(
    {
      preset,
      customCheckoutCop,
      updatedAt: now,
      updatedAtServer: FieldValue.serverTimestamp(),
      updatedByEmail: auth.user.email.trim().toLowerCase(),
    },
    { merge: true },
  );

  const resolved = await getResolvedPlanPlusPricing(firestore);

  await auditPlatformPaymentEvent(firestore, "admin_plan_plus_pricing_updated", {
    preset,
    checkoutCop: resolved.checkoutCop,
    listCompareCop: resolved.listCompareCop,
  });

  return NextResponse.json({
    success: true,
    resolved: {
      checkoutCop: resolved.checkoutCop,
      listCompareCop: resolved.listCompareCop,
      preset: resolved.preset,
    },
  });
}
