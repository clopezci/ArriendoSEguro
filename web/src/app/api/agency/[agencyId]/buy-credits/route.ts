import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getAgencyPlan, getAgencyPlans } from "@/domain/agencies/plans";
import { getPaymentProvider } from "@/domain/platform-payments/provider-factory";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import type { PlatformOrder } from "@/domain/platform-payments/types";

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
    const now = new Date().toISOString();
    const orderRef = firestore.collection("platform_orders").doc();
    const providerReference = `AS_AGCRED_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const selected = getPaymentProvider(parsed.data.paymentProvider);

    // Objeto tipado que entiende el proveedor (planCode "plus" solo para armar el
    // link de pago; el tipo real de la orden se guarda aparte en Firestore).
    const checkoutOrder: PlatformOrder = {
      id: orderRef.id,
      userId: gate.user.uid,
      userEmail: gate.user.email,
      leaseProcessId: null,
      planCode: "plus",
      amount: plan.priceCop,
      currency: "COP",
      status: "created",
      paymentProvider: selected.providerCode,
      providerReference,
      checkoutUrl: "",
      createdAt: now,
      updatedAt: now,
    };

    const checkout = await selected.provider.createCheckout(checkoutOrder);
    await orderRef.set({
      ...checkoutOrder,
      providerReference: checkout.providerReference,
      checkoutUrl: checkout.checkoutUrl,
      status: "pending",
      // --- Datos reales de la compra de créditos de agencia ---
      orderKind: "agency_credits",
      agencyId,
      credits: plan.credits,
      planName: plan.name,
      planCodeAgency: plan.code,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
    });

    await auditPlatformPaymentEvent(firestore, "platform_order_created", {
      orderId: orderRef.id,
      agencyId,
      planCode: plan.code,
      credits: plan.credits,
      amount: plan.priceCop,
      provider: selected.providerCode,
      kind: "agency_credits",
    });

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      checkoutUrl: checkout.checkoutUrl,
      providerCode: selected.providerCode,
      amount: plan.priceCop,
      credits: plan.credits,
    });
  } catch (err) {
    console.error("[buy-credits] fallo:", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo crear la orden de compra." }] }, { status: 500 });
  }
}
