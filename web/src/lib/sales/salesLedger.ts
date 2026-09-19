import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Libro de ventas interno (símil de facturador). Cada venta aprobada queda con
 * una **numeración interna consecutiva** (AS-00001, AS-00002…), para poder
 * exportarlas y, si toca, registrarlas manualmente en la DIAN. Es una vista
 * materializada de `platform_payments` (fuente de la verdad del dinero real),
 * con número propio, idempotente por `paymentId`.
 *
 * Se alimenta automáticamente en cada venta (hook en la liquidación) y se puede
 * re-sincronizar desde /admin (backfill del histórico de Wompi).
 */

export const SALES_LEDGER_COLLECTION = "sales_ledger";
const COUNTER_PATH = "sales_ledger_meta/counter";

export interface SaleRecord {
  id: string; // = paymentId (idempotencia)
  internalNumber: number;
  internalCode: string; // AS-00001
  buyerEmail: string;
  buyerName?: string;
  buyerDocument?: string;
  amountCop: number;
  currency: string;
  provider: string;
  providerPaymentId?: string;
  orderId?: string;
  leaseProcessId?: string | null;
  date: string; // fecha de aprobación (ISO)
  status: string;
  createdAtIso: string;
}

function codeOf(n: number): string {
  return `AS-${String(n).padStart(5, "0")}`;
}

export type RecordSaleInput = {
  paymentId: string;
  buyerEmail: string;
  amountCop: number;
  currency?: string;
  provider: string;
  providerPaymentId?: string;
  orderId?: string;
  leaseProcessId?: string | null;
  approvedAtIso: string;
  buyerName?: string;
  buyerDocument?: string;
};

/**
 * Registra una venta (idempotente por paymentId), asignando el siguiente número
 * consecutivo de forma atómica. Devuelve true si la creó, false si ya existía.
 * Best-effort: no lanza (nunca debe tumbar el flujo de pago).
 */
export async function recordSaleFromPayment(firestore: Firestore, input: RecordSaleInput): Promise<boolean> {
  if (!input.paymentId) return false;
  try {
    const ref = firestore.collection(SALES_LEDGER_COLLECTION).doc(input.paymentId);
    const counterRef = firestore.doc(COUNTER_PATH);
    return await firestore.runTransaction(async (tx) => {
      const [existing, cSnap] = await Promise.all([tx.get(ref), tx.get(counterRef)]);
      if (existing.exists) return false;
      const last = cSnap.exists ? Number((cSnap.data() as { last?: number }).last ?? 0) : 0;
      const n = last + 1;
      const rec: SaleRecord = {
        id: input.paymentId,
        internalNumber: n,
        internalCode: codeOf(n),
        buyerEmail: input.buyerEmail ?? "",
        ...(input.buyerName ? { buyerName: input.buyerName } : {}),
        ...(input.buyerDocument ? { buyerDocument: input.buyerDocument } : {}),
        amountCop: Math.round(input.amountCop ?? 0),
        currency: input.currency ?? "COP",
        provider: input.provider,
        ...(input.providerPaymentId ? { providerPaymentId: input.providerPaymentId } : {}),
        ...(input.orderId ? { orderId: input.orderId } : {}),
        leaseProcessId: input.leaseProcessId ?? null,
        date: input.approvedAtIso,
        status: "APPROVED",
        createdAtIso: new Date().toISOString(),
      };
      tx.set(ref, { ...rec, createdAtServer: FieldValue.serverTimestamp() });
      tx.set(counterRef, { last: n, updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    });
  } catch {
    return false;
  }
}

/**
 * Backfill / red de seguridad: recorre `platform_payments` APROBADOS y registra
 * en el libro los que falten, en orden cronológico (para que la numeración
 * respete el histórico). Devuelve cuántos agregó y el total.
 */
export async function syncSalesLedger(firestore: Firestore): Promise<{ added: number; total: number }> {
  const snap = await firestore.collection("platform_payments").where("status", "==", "APPROVED").limit(5000).get();
  const rows = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));
  const when = (d: Record<string, unknown>) => String((d.approvedAt as string) ?? (d.createdAt as string) ?? "");
  // Cronológico ascendente para numerar el histórico en orden.
  rows.sort((a, b) => when(a.data).localeCompare(when(b.data)));
  let added = 0;
  for (const p of rows) {
    const d = p.data;
    const created = await recordSaleFromPayment(firestore, {
      paymentId: p.id,
      buyerEmail: (d.userEmail as string) ?? "",
      amountCop: Number(d.amount ?? 0),
      currency: (d.currency as string) ?? "COP",
      provider: (d.provider as string) ?? "wompi",
      providerPaymentId: (d.providerPaymentId as string) ?? p.id,
      orderId: (d.orderId as string) ?? undefined,
      leaseProcessId: (d.leaseProcessId as string) ?? null,
      approvedAtIso: when(d) || new Date().toISOString(),
    });
    if (created) added += 1;
  }
  const ledger = await firestore.collection(SALES_LEDGER_COLLECTION).count().get().catch(() => null);
  const total = ledger ? ledger.data().count : rows.length;
  return { added, total };
}

/** Lista las ventas del libro, más recientes primero. */
export async function listSales(firestore: Firestore, limit = 2000): Promise<SaleRecord[]> {
  const snap = await firestore.collection(SALES_LEDGER_COLLECTION).limit(limit).get();
  const rows = snap.docs.map((d) => d.data() as SaleRecord);
  rows.sort((a, b) => (b.internalNumber ?? 0) - (a.internalNumber ?? 0));
  return rows;
}
