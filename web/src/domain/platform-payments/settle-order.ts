import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { auditPlatformPaymentEvent } from "./audit";
import type { PlatformProvider } from "./types";
import { sendEmail } from "@/services/email/sendEmail";
import { plusAccessConfirmedEmail } from "@/services/email/emailTemplates";
import { notifyLegalPartnerForPaidClause } from "@/lib/legal/notifySpecialClause";

/**
 * Liquida una orden de plataforma (Plan Plus) **aprobada** de forma idempotente:
 * marca la orden, registra el pago, crea el acceso Plus, envía el correo de
 * confirmación y notifica al aliado jurídico si el contrato traía cláusula «Otra».
 *
 * Sirve para cualquier proveedor (Bre-B, y a futuro otros). El webhook de Wompi
 * mantiene su propia liquidación por compatibilidad; este helper es la base común.
 */
export async function settleApprovedPlatformOrder(
  firestore: Firestore,
  params: {
    provider: PlatformProvider;
    providerReference: string;
    providerPaymentId: string;
    amountInCents: number;
    currency: string;
    method: string;
    rawEvent: string;
    nowMs: number;
  },
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const orderSnap = await firestore
    .collection("platform_orders")
    .where("providerReference", "==", params.providerReference)
    .limit(1)
    .get();
  const orderDoc = orderSnap.docs[0];
  if (!orderDoc) return { httpStatus: 404, body: { success: false, error: "order_not_found" } };
  const order = orderDoc.data() as {
    id: string;
    userId: string;
    userEmail: string;
    amount: number;
    currency: string;
    leaseProcessId?: string | null;
  };

  // Idempotencia.
  const dup = await firestore
    .collection("platform_payments")
    .where("orderId", "==", order.id)
    .where("providerPaymentId", "==", params.providerPaymentId)
    .limit(1)
    .get();
  if (!dup.empty) return { httpStatus: 200, body: { success: true, duplicated: true } };

  // Integridad de monto (en centavos) frente a la orden.
  const orderCents = Math.round(Number(order.amount) * 100);
  if (params.amountInCents && orderCents && params.amountInCents !== orderCents) {
    return { httpStatus: 422, body: { success: false, error: "amount_mismatch" } };
  }

  const now = new Date(params.nowMs).toISOString();
  await orderDoc.ref.set(
    { status: "approved", updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );

  const payRef = firestore.collection("platform_payments").doc();
  await payRef.set({
    id: payRef.id,
    orderId: order.id,
    userId: order.userId,
    userEmail: order.userEmail,
    provider: params.provider,
    providerPaymentId: params.providerPaymentId || payRef.id,
    amount: order.amount,
    currency: params.currency || order.currency,
    status: "APPROVED",
    paymentMethod: params.method,
    rawProviderResponse: params.rawEvent,
    approvedAt: now,
    createdAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });

  const entRef = firestore.collection("access_entitlements").doc();
  await entRef.set({
    id: entRef.id,
    userId: order.userId,
    userEmail: order.userEmail,
    leaseProcessId: order.leaseProcessId ?? null,
    planCode: "plus",
    accessType: "plus_paid",
    status: "active",
    maxContractsAllowed: 1,
    contractsUsed: 0,
    validUntil: null,
    createdAt: now,
    updatedAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
    updatedAtServer: FieldValue.serverTimestamp(),
  });

  await auditPlatformPaymentEvent(firestore, "platform_payment_approved", {
    orderId: order.id,
    paymentId: payRef.id,
    provider: params.provider,
  });
  await auditPlatformPaymentEvent(firestore, "access_entitlement_created", {
    entitlementId: entRef.id,
    orderId: order.id,
  });

  const tpl = plusAccessConfirmedEmail({ userEmail: order.userEmail, source: "payment" });
  await sendEmail({
    to: order.userEmail,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    templateCode: "plusAccessConfirmedEmail",
    relatedEntityType: "platform_order",
    relatedEntityId: order.id,
  });

  await notifyLegalPartnerForPaidClause(firestore, order.leaseProcessId ?? null).catch(() => {});

  return { httpStatus: 200, body: { success: true, status: "approved" } };
}
