import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { computePlanPlusOrderAmount, debugSpecialClauseSignals } from "@/domain/platform-payments/order-amount";

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

  const url = new URL(request.url);
  const leaseProcessId = url.searchParams.get("leaseProcessId");
  const amount = await computePlanPlusOrderAmount(firestore, { leaseProcessId });

  // Diagnóstico opcional (?debug=1): expone las señales crudas que deciden si se
  // cobra la cláusula «Otra», para depurar sin adivinar. Solo para el expediente
  // indicado y el usuario autenticado.
  const debug =
    url.searchParams.get("debug") === "1" && leaseProcessId
      ? await debugSpecialClauseSignals(firestore, leaseProcessId)
      : undefined;

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
    ...(debug ? { debug } : {}),
  });
}
