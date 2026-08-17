import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import { verifyWompiWebhookSignature } from "@/domain/platform-payments/wompi-signature";
import { decideWebhookHandling } from "@/domain/platform-payments/webhook-logic";
import { processHubWompiEvent } from "@/domain/hub/hub-webhook";
import { processCustodyWompiEvent, CUSTODY_REFERENCE_PREFIX } from "@/features/contracts/custody-webhook";
import { plusAccessConfirmedEmail } from "@/services/email/emailTemplates";
import { sendEmail } from "@/services/email/sendEmail";
import { notifyLegalPartnerForPaidClause } from "@/lib/legal/notifySpecialClause";
import { logServerError } from "@/lib/observability/observability";

export const runtime = "nodejs";

/**
 * Verificación en el navegador. El webhook real lo llama la pasarela por POST; un
 * GET (abrirlo en el navegador) devolvía 405 sin cuerpo → el navegador mostraba
 * "ERR_INVALID_RESPONSE" y parecía caído. Este GET responde 200 con un mensaje
 * claro para confirmar que el endpoint está desplegado y alcanzable.
 */
export function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "platform-payments/webhook",
    accepts: "POST",
    info: "Este endpoint recibe los eventos de pago (webhook) de la pasarela por POST. Verlo en el navegador solo confirma que está publicado; regístralo en el panel de la pasarela como URL de eventos.",
  });
}

export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  let event: {
    event?: string;
    data?: {
      transaction?: {
        id?: string;
        status?: string;
        amount_in_cents?: number;
        currency?: string;
        reference?: string;
        payment_method_type?: string;
      };
    };
    signature?: { checksum?: string; properties?: string[] };
  };
  try {
    event = JSON.parse(rawBody) as {
      event?: string;
      data?: {
        transaction?: {
          id?: string;
          status?: string;
          amount_in_cents?: number;
          currency?: string;
          reference?: string;
          payment_method_type?: string;
        };
      };
      signature?: { checksum?: string; properties?: string[] };
    };
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "payload", message: "Webhook body inválido." }] },
      { status: 422 },
    );
  }

  const sig = verifyWompiWebhookSignature(event, request.headers);
  const validSignature = sig.valid;
  await auditPlatformPaymentEvent(firestore, "platform_payment_webhook_received", {
    validSignature,
  });
  if (!validSignature) {
    await auditPlatformPaymentEvent(firestore, "platform_payment_webhook_invalid_signature", {});
    return NextResponse.json({ success: false, errors: [{ field: "signature", message: "Firma webhook inválida." }] }, { status: 401 });
  }

  try {
    const tx = event.data?.transaction;
    const providerReference = tx?.reference ?? "";
    const amount = Math.floor((tx?.amount_in_cents ?? 0) / 100);
    const currency = tx?.currency ?? "";
    const providerPaymentId = tx?.id ?? "";

    // Órdenes del HUB (apps externas): se enrutan aparte. La misma URL de eventos
    // de Wompi sirve para ArriendoSeguro y para el hub.
    if (providerReference.startsWith("HUB_")) {
      const result = await processHubWompiEvent(firestore, event, Date.now());
      return NextResponse.json(result.body, { status: result.httpStatus });
    }

    // Custodia en la nube de un contrato ($20.000): rama propia, no es Plan Plus.
    if (providerReference.startsWith(CUSTODY_REFERENCE_PREFIX)) {
      const result = await processCustodyWompiEvent(firestore, event);
      return NextResponse.json(result.body, { status: result.httpStatus });
    }

    const orderSnap = await firestore
      .collection("platform_orders")
      .where("providerReference", "==", providerReference)
      .limit(1)
      .get();
    const orderDoc = orderSnap.docs[0];
    const order = (orderDoc?.data() as {
      id: string;
      userId: string;
      userEmail: string;
      leaseProcessId?: string | null;
      status: string;
      planCode?: string;
      amount?: number;
    }) ?? {
      id: "",
      userId: "",
      userEmail: "",
      status: "",
      planCode: undefined,
    };

    const expectedOrderAmountCop = typeof order.amount === "number" && Number.isInteger(order.amount) ? order.amount : -1;

    const duplicatePayment = orderDoc
      ? await firestore
          .collection("platform_payments")
          .where("orderId", "==", order.id)
          .where("providerPaymentId", "==", providerPaymentId)
          .limit(1)
          .get()
      : null;
    const decision = decideWebhookHandling({
      eventName: event.event,
      amount,
      expectedOrderAmountCop,
      currency,
      providerReference,
      orderFound: Boolean(orderDoc),
      orderPlanCode: order?.planCode,
      orderStatus: order?.status,
      duplicatePayment: Boolean(duplicatePayment && !duplicatePayment.empty),
      transactionStatus: tx?.status,
    });
    if (decision.kind === "ignore") {
      return NextResponse.json({ success: true, ignored: decision.reason });
    }
    if (decision.kind === "reject") {
      if (decision.auditEvent) {
        await auditPlatformPaymentEvent(firestore, decision.auditEvent, {
          providerReference,
          amount,
          currency,
        });
      }
      const statusCode = decision.field === "order" ? 404 : 422;
      return NextResponse.json(
        { success: false, errors: [{ field: decision.field, message: decision.message }] },
        { status: statusCode },
      );
    }
    if (!orderDoc) {
      return NextResponse.json({ success: false, errors: [{ field: "order", message: "Orden no encontrada para referencia." }] }, { status: 404 });
    }
    const now = new Date().toISOString();
    if (decision.kind === "duplicate") {
      await auditPlatformPaymentEvent(firestore, "platform_payment_webhook_duplicate_ignored", {
        orderId: order.id,
        providerPaymentId,
      });
      return NextResponse.json({ success: true, duplicated: true });
    }
    if (decision.kind === "approve") {
      const duplicatePayment = await firestore
        .collection("platform_payments")
        .where("orderId", "==", order.id)
        .where("providerPaymentId", "==", providerPaymentId)
        .limit(1)
        .get();
      if (!duplicatePayment.empty) return NextResponse.json({ success: true, duplicated: true });

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
        provider: "wompi",
        providerPaymentId: providerPaymentId || payRef.id,
        amount,
        currency: "COP",
        status: tx?.status ?? "APPROVED",
        paymentMethod: tx?.payment_method_type ?? "unknown",
        rawProviderResponse: JSON.stringify(event),
        approvedAt: now,
        createdAt: now,
        createdAtServer: FieldValue.serverTimestamp(),
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
        providerPaymentId,
      });
      await auditPlatformPaymentEvent(firestore, "access_entitlement_created", {
        entitlementId: entitlementRef.id,
        orderId: order.id,
      });
      const plusTemplate = plusAccessConfirmedEmail({ userEmail: order.userEmail, source: "payment" });
      const emailResult = await sendEmail({
        to: order.userEmail,
        subject: plusTemplate.subject,
        html: plusTemplate.html,
        text: plusTemplate.text,
        templateCode: "plusAccessConfirmedEmail",
        relatedEntityType: "platform_order",
        relatedEntityId: order.id,
      });
      if (emailResult.status !== "sent" && emailResult.status !== "mock") {
        await auditPlatformPaymentEvent(firestore, "plus_access_email_failed", {
          orderId: order.id,
          status: emailResult.status,
        });
      }
      // Pago aprobado: recién ahora se notifica al aliado jurídico la cláusula
      // «Otra» (si la hay). Antes del pago el abogado no se molesta.
      await notifyLegalPartnerForPaidClause(firestore, order.leaseProcessId).catch(() => {});
      return NextResponse.json({ success: true, status: "approved" });
    }
    const mappedOrderStatus = decision.status;
    await orderDoc.ref.set(
      { status: mappedOrderStatus, updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() },
      { merge: true },
    );
    if (mappedOrderStatus === "rejected") {
      await auditPlatformPaymentEvent(firestore, "platform_payment_rejected", { orderId: order.id });
    }
    return NextResponse.json({ success: true, status: mappedOrderStatus });
  } catch (err) {
    await logServerError("platform-payments/webhook", err);
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo procesar webhook Wompi." }] },
      { status: 500 },
    );
  }
}

