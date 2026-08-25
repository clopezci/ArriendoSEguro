import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { wompiApiBaseUrl } from "@/domain/platform-payments/wompi-checkout";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import { isInternalAdminEmailAsync } from "@/lib/admin/internal-admin";
import { notifyLegalPartnerForPaidClause } from "@/lib/legal/notifySpecialClause";
import { plusAccessConfirmedEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";

export const runtime = "nodejs";

/**
 * Reconciliación de un pago consultando DIRECTAMENTE a Wompi por el id de la
 * transacción (`GET /v1/transactions/{id}`). Es la red de seguridad que hace que
 * el plan se active aunque el webhook no llegue: Wompi devuelve el id de la
 * transacción en la URL de retorno, y aquí lo verificamos contra la orden.
 *
 * Anti-fraude: la transacción debe estar APROBADA, su `reference` debe coincidir
 * con la de la orden y el monto no puede ser menor. Idempotente por transacción
 * (no crea pagos ni accesos duplicados).
 */
const schema = z
  .object({
    reference: z.string().min(3).optional(),
    orderId: z.string().min(3).optional(),
    wompiTransactionId: z.string().min(3),
  })
  .refine((d) => Boolean(d.reference || d.orderId), { message: "reference u orderId requerido" });

type OrderDoc = {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  providerReference: string;
  leaseProcessId?: string | null;
  planCode?: string;
  status?: string;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }

    // Resolver la orden por id o por referencia del comercio.
    let orderRef;
    if (parsed.data.orderId) {
      orderRef = firestore.collection("platform_orders").doc(parsed.data.orderId);
    } else {
      const snap = await firestore
        .collection("platform_orders")
        .where("providerReference", "==", parsed.data.reference)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json({ success: false, errors: [{ field: "reference", message: "Orden no encontrada." }] }, { status: 404 });
      }
      orderRef = snap.docs[0].ref;
    }
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "order", message: "Orden no encontrada." }] }, { status: 404 });
    }
    const order = orderSnap.data() as OrderDoc;

    const isOwner = order.userId === auth.user.uid;
    const isAdmin = await isInternalAdminEmailAsync(auth.user.email);
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, errors: [{ field: "auth", message: "No autorizado para esta orden." }] }, { status: 403 });
    }

    const txId = parsed.data.wompiTransactionId;

    // ¿Ya reconciliada esta transacción? (idempotencia por pago)
    const dupPay = await firestore
      .collection("platform_payments")
      .where("orderId", "==", order.id)
      .where("providerPaymentId", "==", txId)
      .limit(1)
      .get();

    const privateKey = (process.env.WOMPI_PRIVATE_KEY ?? "").trim();
    if (!privateKey) {
      return NextResponse.json({ success: false, errors: [{ field: "server", message: "Pasarela no configurada (falta llave privada)." }] }, { status: 503 });
    }

    // Consulta autoritativa a Wompi.
    const res = await fetch(`${wompiApiBaseUrl()}/transactions/${encodeURIComponent(txId)}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
      cache: "no-store",
    });
    const raw = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { success: false, errors: [{ field: "gateway", message: `Wompi respondió ${res.status} al consultar la transacción.`, detail: raw.slice(0, 300) }] },
        { status: 502 },
      );
    }
    let tx: { status?: string; reference?: string; amount_in_cents?: number; payment_method_type?: string } = {};
    try {
      tx = (JSON.parse(raw)?.data ?? {}) as typeof tx;
    } catch {
      return NextResponse.json({ success: false, errors: [{ field: "gateway", message: "Respuesta de Wompi ilegible." }] }, { status: 502 });
    }

    const txStatus = String(tx.status ?? "").toUpperCase();
    const txRef = String(tx.reference ?? "");
    const txAmountCents = Number(tx.amount_in_cents ?? 0);
    const expectedCents = Math.round((order.amount ?? 0) * 100);

    // Anti-fraude: la transacción debe ser de ESTA orden.
    if (txRef !== order.providerReference) {
      return NextResponse.json({ success: false, errors: [{ field: "reference", message: "La transacción no corresponde a esta orden." }] }, { status: 422 });
    }
    if (txAmountCents < expectedCents) {
      return NextResponse.json({ success: false, errors: [{ field: "amount", message: "El monto de la transacción es menor al de la orden." }] }, { status: 422 });
    }

    if (txStatus !== "APPROVED") {
      // Aún no aprobada (PENDING) o rechazada: no es error, simplemente no activa.
      await auditPlatformPaymentEvent(firestore, "platform_payment_reconcile_not_approved", {
        orderId: order.id,
        providerPaymentId: txId,
        transactionStatus: txStatus || "UNKNOWN",
      });
      return NextResponse.json({ success: true, plusActive: false, transactionStatus: txStatus || "UNKNOWN" });
    }

    const now = new Date().toISOString();

    // Solo la PRIMERA reconciliación de esta transacción crea pago + acceso.
    if (dupPay.empty) {
      await orderRef.set({ status: "approved", updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true });

      const payRef = firestore.collection("platform_payments").doc();
      await payRef.set({
        id: payRef.id,
        orderId: order.id,
        userId: order.userId,
        userEmail: order.userEmail,
        provider: "wompi",
        providerPaymentId: txId,
        amount: Math.floor(txAmountCents / 100),
        currency: "COP",
        status: "APPROVED",
        paymentMethod: String(tx.payment_method_type ?? "unknown"),
        rawProviderResponse: raw.slice(0, 4000),
        approvedAt: now,
        createdAt: now,
        createdAtServer: FieldValue.serverTimestamp(),
        source: "reconcile",
      });

      const entitlementRef = firestore.collection("access_entitlements").doc();
      await entitlementRef.set({
        id: entitlementRef.id,
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
        providerPaymentId: txId,
        via: "reconcile",
      });
      await auditPlatformPaymentEvent(firestore, "access_entitlement_created", {
        entitlementId: entitlementRef.id,
        orderId: order.id,
        via: "reconcile",
      });

      // Correo de confirmación + aviso al aliado jurídico (mejor esfuerzo).
      const t = plusAccessConfirmedEmail({ userEmail: order.userEmail, source: "payment" });
      await sendEmail({
        to: order.userEmail,
        subject: t.subject,
        html: t.html,
        text: t.text,
        templateCode: "plusAccessConfirmedEmail",
        relatedEntityType: "platform_order",
        relatedEntityId: order.id,
      }).catch(() => {});
      await notifyLegalPartnerForPaidClause(firestore, order.leaseProcessId).catch(() => {});
    }

    return NextResponse.json({ success: true, plusActive: true, transactionStatus: "APPROVED", leaseProcessId: order.leaseProcessId ?? null });
  } catch (err) {
    console.error("[reconcile] error:", err);
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo reconciliar el pago." }] }, { status: 500 });
  }
}
