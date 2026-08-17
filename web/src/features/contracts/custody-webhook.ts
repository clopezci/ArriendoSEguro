import "server-only";
import { FieldValue, type Firestore } from "firebase-admin/firestore";

/** Precio de la custodia en la nube (COP). Debe coincidir con create-order. */
export const CUSTODY_PRICE_COP = 20000;
/** Años de custodia en la nube. */
export const CUSTODY_YEARS = 5;
export const CUSTODY_REFERENCE_PREFIX = "CUSTODIA_";
export const CUSTODY_ORDERS_COLLECTION = "custody_orders";

type WompiEventLike = { data?: { transaction?: { reference?: string; status?: string; amount_in_cents?: number; id?: string } } };

/**
 * Procesa un evento de Wompi cuyo `reference` es de CUSTODIA (custodia en la nube
 * de un contrato). Al aprobarse el pago de $20.000, activa la custodia en el
 * contrato (retentionChoice="cloud", cloudRetentionUntil +5 años, cancela la
 * purga). Idempotente por el estado de la orden.
 */
export async function processCustodyWompiEvent(
  firestore: Firestore,
  event: WompiEventLike,
): Promise<{ body: Record<string, unknown>; httpStatus: number }> {
  const tx = event?.data?.transaction;
  const reference = tx?.reference ?? "";
  const status = String(tx?.status ?? "").toUpperCase();
  const amount = Math.floor((tx?.amount_in_cents ?? 0) / 100);
  const providerPaymentId = tx?.id ?? "";
  const nowISO = new Date().toISOString();

  const snap = await firestore.collection(CUSTODY_ORDERS_COLLECTION).where("reference", "==", reference).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return { body: { success: true, ignored: "order_not_found" }, httpStatus: 200 };
  const order = doc.data() as { contractId?: string; status?: string };
  if (order.status === "approved") return { body: { success: true, idempotent: true }, httpStatus: 200 };

  if (status !== "APPROVED") {
    await doc.ref.set({ status: status.toLowerCase() || "pending", providerPaymentId, updatedAt: nowISO }, { merge: true });
    return { body: { success: true, status }, httpStatus: 200 };
  }
  if (amount < CUSTODY_PRICE_COP) {
    await doc.ref.set({ status: "amount_mismatch", providerPaymentId, updatedAt: nowISO }, { merge: true });
    return { body: { success: false, error: "amount_mismatch" }, httpStatus: 200 };
  }

  const now = new Date();
  const cloudUntil = new Date(now);
  cloudUntil.setUTCFullYear(cloudUntil.getUTCFullYear() + CUSTODY_YEARS);
  await doc.ref.set({ status: "approved", providerPaymentId, approvedAt: now.toISOString(), updatedAt: now.toISOString() }, { merge: true });
  if (order.contractId) {
    await firestore.collection("contracts").doc(order.contractId).set(
      {
        retentionChoice: "cloud",
        custodyPaidAt: now.toISOString(),
        cloudRetentionUntil: cloudUntil.toISOString(),
        purgeScheduledAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  return { body: { success: true, activated: true }, httpStatus: 200 };
}
