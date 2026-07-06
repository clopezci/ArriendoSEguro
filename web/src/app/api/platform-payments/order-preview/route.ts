import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { computePlanPlusOrderAmount } from "@/domain/platform-payments/order-amount";

export const runtime = "nodejs";

/**
 * Vista previa del "carrito" del Plan Plus para un expediente: Plan Plus vigente
 * + la cláusula «Otra» si el contrato la incluye. Solo lectura, para mostrar el
 * desglose antes de pagar. El total autoritativo se recalcula en create-order.
 */
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

  const leaseProcessId = new URL(request.url).searchParams.get("leaseProcessId");
  const amount = await computePlanPlusOrderAmount(firestore, { leaseProcessId });

  return NextResponse.json({
    success: true,
    lineItems: amount.lineItems,
    planPlusCop: amount.planPlusCop,
    listCompareCop: amount.listCompareCop,
    clauseCop: amount.clauseCop,
    hasCostedClause: amount.hasCostedClause,
    totalCop: amount.totalCop,
    promoName: amount.promoName,
    promoMessage: amount.promoMessage,
  });
}
