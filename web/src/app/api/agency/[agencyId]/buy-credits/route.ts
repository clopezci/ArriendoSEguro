import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getAgencyPlan, getAgencyPlans } from "@/domain/agencies/plans";
import { createAgencyCreditOrder } from "@/lib/agencies/creditOrders";

export const runtime = "nodejs";

/** GET — planes de crédito disponibles para la agencia. */
export async function GET(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const plans = (await getAgencyPlans(gate.firestore)).filter((p) => p.active);
  return NextResponse.json({ success: true, plans });
}

const schema = z.object({
  planCode: z.string().trim().min(1),
  paymentProvider: z.enum(["mock", "wompi", "breb"]).optional(),
});

/**
 * POST /api/agency/[agencyId]/buy-credits — crea una orden de compra de un plan
 * de créditos (prepago) y devuelve el checkout. Al aprobarse el pago, los
 * créditos se recargan automáticamente (hook en la liquidación).
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const { firestore } = gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }

  const plan = await getAgencyPlan(firestore, parsed.data.planCode);
  if (!plan) {
    return NextResponse.json({ success: false, errors: [{ field: "planCode", message: "Plan no disponible." }] }, { status: 404 });
  }

  try {
    const created = await createAgencyCreditOrder(firestore, {
      agencyId,
      plan,
      userId: gate.user.uid,
      userEmail: gate.user.email,
      provider: parsed.data.paymentProvider,
    });
    return NextResponse.json({
      success: true,
      orderId: created.orderId,
      checkoutUrl: created.checkoutUrl,
      providerCode: created.providerCode,
      amount: plan.priceCop,
      credits: plan.credits,
    });
  } catch (err) {
    console.error("[buy-credits] fallo:", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo crear la orden de compra." }] }, { status: 500 });
  }
}
