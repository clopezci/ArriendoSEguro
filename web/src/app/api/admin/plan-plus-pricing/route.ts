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
} from "@/domain/platform-payments/plan-plus-pricing";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    mode: z.enum(["full", "promo"]),
    listCop: z
      .number()
      .int()
      .min(PLAN_PLUS_CUSTOM_COP_LIMITS.min)
      .max(PLAN_PLUS_CUSTOM_COP_LIMITS.max)
      .optional(),
    promoType: z.enum(["fixed", "percent"]).optional(),
    promoFixedCop: z
      .number()
      .int()
      .min(PLAN_PLUS_CUSTOM_COP_LIMITS.min)
      .max(PLAN_PLUS_CUSTOM_COP_LIMITS.max)
      .optional(),
    promoPercent: z.number().min(0.1).max(95).optional(),
    promoName: z.string().trim().max(60).optional(),
    promoMessage: z.string().trim().max(160).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode !== "promo") return;
    const type = data.promoType ?? "fixed";
    if (type === "fixed" && data.promoFixedCop == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica el precio promocional en COP.",
        path: ["promoFixedCop"],
      });
    }
    if (type === "percent" && data.promoPercent == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica el % de descuento de la promoción.",
        path: ["promoPercent"],
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
    resolved,
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
  const d = parsed.data;
  const isPromo = d.mode === "promo";
  const promoType = isPromo ? (d.promoType ?? "fixed") : null;

  await firestore.collection(PLAN_PLUS_PRICING_COLLECTION).doc(PLAN_PLUS_PRICING_DOC_ID).set(
    {
      mode: d.mode,
      listCop: d.listCop ?? null,
      promoType,
      promoFixedCop: isPromo && promoType === "fixed" ? (d.promoFixedCop ?? null) : null,
      promoPercent: isPromo && promoType === "percent" ? (d.promoPercent ?? null) : null,
      promoName: isPromo ? (d.promoName?.trim() || null) : null,
      promoMessage: isPromo ? (d.promoMessage?.trim() || null) : null,
      // Limpia campos del esquema anterior para no confundir el resolver.
      preset: FieldValue.delete(),
      customCheckoutCop: FieldValue.delete(),
      customListCop: FieldValue.delete(),
      updatedAt: now,
      updatedAtServer: FieldValue.serverTimestamp(),
      updatedByEmail: auth.user.email.trim().toLowerCase(),
    },
    { merge: true },
  );

  const resolved = await getResolvedPlanPlusPricing(firestore);

  await auditPlatformPaymentEvent(firestore, "admin_plan_plus_pricing_updated", {
    mode: d.mode,
    checkoutCop: resolved.checkoutCop,
    listCompareCop: resolved.listCompareCop,
    isPromo: resolved.isPromo,
  });

  return NextResponse.json({ success: true, resolved });
}
