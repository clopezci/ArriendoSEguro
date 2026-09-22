import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { auditPlatformPaymentEvent } from "./audit";
import type { PlatformProvider } from "./types";
import { sendEmail } from "@/services/email/sendEmail";
import { plusAccessConfirmedEmail } from "@/services/email/emailTemplates";
import { notifyLegalPartnerForPaidClause } from "@/lib/legal/notifySpecialClause";
import { recordSaleFromPayment } from "@/lib/sales/salesLedger";
import { addCredits } from "@/lib/agencies/agencyStore";

/**
 * Liquida una orden de plataforma (Plan Plus) **aprobada** de forma idempotente:
 * marca la orden, registra el pago, crea el acceso Plus, envía el correo de
 * confirmación y notifica al aliado jurídico si el contrato traía cláusula «Otra».
 *
 * Sirve para cualquier proveedor (Bre-B, y a futuro otros). El webhook de Wompi
 * mantiene su propia liquidación por compatibilidad; este helper es la base común.
 */
/**
 * Reclama de forma ATÓMICA la liquidación de una orden: marca `settledAt` solo
 * si aún no estaba liquidada, dentro de una transacción. Devuelve `true` para el
 * único ganador; `false` si otra ejecución ya la reclamó (webhook duplicado,
 * carrera webhook↔barrido, doble entrega de Wompi). Cierra el hueco de doble
 * acreditación de créditos / doble acceso Plus (check-then-act no atómico).
 */
export async function claimOrderForSettlement(
  firestore: Firestore,
  orderRef: DocumentReference,
  providerPaymentId: string,
  nowIso: string,
): Promise<boolean> {
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    const data = snap.data() as { settledAt?: string } | undefined;
    if (data?.settledAt) return false; // ya liquidada por otra ejecución
    tx.set(
      orderRef,
      {
        status: "approved",
        settledAt: nowIso,
        settledPaymentId: providerPaymentId || null,
        updatedAt: nowIso,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  });
}

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
    orderKind?: string;
    agencyId?: string;
    credits?: number;
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
  // Reclamo atómico: solo el ganador liquida (evita doble acreditación por
  // webhook duplicado o carrera con el barrido diario).
  const claimed = await claimOrderForSettlement(firestore, orderDoc.ref, params.providerPaymentId, now);
  if (!claimed) return { httpStatus: 200, body: { success: true, duplicated: true } };

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

  await auditPlatformPaymentEvent(firestore, "platform_payment_approved", {
    orderId: order.id,
    paymentId: payRef.id,
    provider: params.provider,
  });

  if (order.orderKind === "agency_credits" && order.agencyId) {
    // Compra de créditos de agencia: recarga automática del saldo. No crea acceso
    // Plus ni notifica al aliado jurídico.
    await addCredits(firestore, order.agencyId, Number(order.credits ?? 0));
    await auditPlatformPaymentEvent(firestore, "agency_credits_added", {
      agencyId: order.agencyId,
      credits: order.credits ?? 0,
      orderId: order.id,
    });
  } else {
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
  }

  // Libro de ventas interno (numeración propia). Best-effort: no afecta el pago.
  await recordSaleFromPayment(firestore, {
    paymentId: payRef.id,
    buyerEmail: order.userEmail,
    amountCop: order.amount,
    currency: params.currency || order.currency,
    provider: params.provider,
    providerPaymentId: params.providerPaymentId || payRef.id,
    orderId: order.id,
    leaseProcessId: order.leaseProcessId ?? null,
    approvedAtIso: now,
  });

  return { httpStatus: 200, body: { success: true, status: "approved" } };
}
