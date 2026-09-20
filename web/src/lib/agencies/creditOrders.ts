import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getPaymentProvider } from "@/domain/platform-payments/provider-factory";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import type { PlatformOrder, PlatformProvider } from "@/domain/platform-payments/types";
import type { AgencyPlan } from "@/domain/agencies/plans";

/**
 * Crea una orden de compra de un plan de créditos de agencia y devuelve el
 * checkout. Reutilizable por el endpoint de compra manual y por la auto-recarga.
 * Al aprobarse el pago, el settler/webhook detectan `orderKind:agency_credits`
 * y recargan el saldo (idempotente).
 */
export async function createAgencyCreditOrder(
  firestore: Firestore,
  params: { agencyId: string; plan: AgencyPlan; userId: string; userEmail: string; provider?: PlatformProvider; via?: string },
): Promise<{ orderId: string; checkoutUrl: string; providerCode: string }> {
  const { agencyId, plan } = params;
  const now = new Date().toISOString();
  const orderRef = firestore.collection("platform_orders").doc();
  const providerReference = `AS_AGCRED_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const selected = getPaymentProvider(params.provider);

  const checkoutOrder: PlatformOrder = {
    id: orderRef.id,
    userId: params.userId,
    userEmail: params.userEmail,
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
    orderKind: "agency_credits",
    agencyId,
    credits: plan.credits,
    planName: plan.name,
    planCodeAgency: plan.code,
    ...(params.via ? { via: params.via } : {}),
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
    ...(params.via ? { via: params.via } : {}),
  });

  return { orderId: orderRef.id, checkoutUrl: checkout.checkoutUrl, providerCode: selected.providerCode };
}
