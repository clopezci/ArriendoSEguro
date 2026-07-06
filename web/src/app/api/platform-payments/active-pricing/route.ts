import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getPlanPlusPricingForPublicPages } from "@/domain/platform-payments/plan-plus-pricing";

export const runtime = "nodejs";

/** Precio público actual del Plan Plus (sin autenticación). Usa la misma configuración que el checkout. */
export async function GET() {
  const firestore = getAdminFirestore();
  const pricing = await getPlanPlusPricingForPublicPages(firestore);
  return NextResponse.json({
    success: true,
    checkoutCop: pricing.checkoutCop,
    listCompareCop: pricing.listCompareCop,
    isPromo: pricing.isPromo,
    promoName: pricing.promoName,
    promoMessage: pricing.promoMessage,
  });
}
