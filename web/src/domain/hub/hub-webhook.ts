/**
 * Procesa un evento de Wompi que pertenece a una orden del HUB (referencia
 * `HUB_*`). Valida monto/moneda, marca el estado de la orden, registra el pago
 * (idempotente) y REENVÍA una notificación firmada a la app externa dueña.
 */

import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { getHubAppById } from "./hub-apps";
import { notifyHubApp } from "./hub-notify";

type WompiTx = {
  id?: string;
  status?: string;
  amount_in_cents?: number;
  currency?: string;
  reference?: string;
  payment_method_type?: string;
};

export type HubOrder = {
  id: string;
  appId: string;
  amountInCents: number;
  currency: string;
  externalReference: string | null;
  providerReference: string;
  status: string;
  customerEmail: string | null;
  metadata: Record<string, unknown> | null;
};

/** Mapea el estado de Wompi al estado de la orden del hub. */
export function mapWompiStatusToOrderStatus(wompiStatus: string | undefined): "approved" | "rejected" | "pending" {
  switch ((wompiStatus ?? "").toUpperCase()) {
    case "APPROVED":
      return "approved";
    case "DECLINED":
    case "VOIDED":
    case "ERROR":
      return "rejected";
    default:
      return "pending";
  }
}

export async function processHubWompiEvent(
  firestore: Firestore,
  event: { event?: string; data?: { transaction?: WompiTx } },
  nowMs: number,
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const tx = event.data?.transaction;
  const providerReference = tx?.reference ?? "";
  const providerPaymentId = tx?.id ?? "";
  const amountInCents = Number(tx?.amount_in_cents ?? 0);
  const currency = (tx?.currency ?? "").toUpperCase();

  const snap = await firestore
    .collection("hub_orders")
    .where("providerReference", "==", providerReference)
    .limit(1)
    .get();
  const orderDoc = snap.docs[0];
  if (!orderDoc) {
    return { httpStatus: 404, body: { success: false, error: "hub_order_not_found" } };
  }
  const order = orderDoc.data() as HubOrder;

  // Idempotencia: si ya registramos este pago para esta orden, no repetimos.
  const dup = await firestore
    .collection("hub_payments")
    .where("orderId", "==", order.id)
    .where("providerPaymentId", "==", providerPaymentId)
    .limit(1)
    .get();
  if (!dup.empty) {
    return { httpStatus: 200, body: { success: true, duplicated: true } };
  }

  // Validaciones de integridad (monto/moneda exactos frente a la orden).
  if (Number.isInteger(order.amountInCents) && amountInCents !== order.amountInCents) {
    return { httpStatus: 422, body: { success: false, error: "amount_mismatch" } };
  }
  if (order.currency && currency && currency !== order.currency.toUpperCase()) {
    return { httpStatus: 422, body: { success: false, error: "currency_mismatch" } };
  }

  const status = mapWompiStatusToOrderStatus(tx?.status);
  const now = new Date(nowMs).toISOString();

  await orderDoc.ref.set(
    { status, updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() },
    { merge: true },
  );

  const payRef = firestore.collection("hub_payments").doc();
  await payRef.set({
    id: payRef.id,
    orderId: order.id,
    appId: order.appId,
    provider: "wompi",
    providerPaymentId: providerPaymentId || payRef.id,
    amountInCents,
    currency: currency || order.currency,
    wompiStatus: tx?.status ?? "",
    status,
    paymentMethod: tx?.payment_method_type ?? "unknown",
    rawProviderResponse: JSON.stringify(event),
    createdAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });

  // Reenvío firmado a la app externa (mejor esfuerzo; la app también puede
  // consultar GET /api/hub/orders/:id).
  const app = await getHubAppById(firestore, order.appId);
  let notified: { ok: boolean; status?: number } = { ok: false };
  if (app) {
    notified = await notifyHubApp(
      app,
      {
        type: "payment.updated",
        orderId: order.id,
        reference: order.providerReference,
        externalReference: order.externalReference,
        status,
        wompiStatus: tx?.status ?? "",
        amountInCents,
        currency: currency || order.currency,
        providerPaymentId,
        metadata: order.metadata ?? null,
      },
      nowMs,
    );
    await orderDoc.ref.set(
      { lastNotifiedAt: now, lastNotifyOk: notified.ok },
      { merge: true },
    );
  }

  return { httpStatus: 200, body: { success: true, status, notified: notified.ok } };
}
