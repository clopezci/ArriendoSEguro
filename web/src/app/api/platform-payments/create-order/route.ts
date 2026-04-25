import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser, requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { PLATFORM_PLAN_PLUS_PRICE_COP } from "@/domain/platform-payments/plans";
import { getPaymentProvider } from "@/domain/platform-payments/provider-factory";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";
import { normalizeCreateOrderIdentity } from "@/domain/platform-payments/order-rules";

export const runtime = "nodejs";

const schema = z.object({
  planCode: z.literal("plus"),
  leaseProcessId: z.string().min(3).optional(),
  paymentProvider: z.enum(["mock", "wompi"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Firestore/Firebase Admin no configurado." }] },
      { status: 503 },
    );
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const orderRef = firestore.collection("platform_orders").doc();
    const providerReference = `AS_PLUS_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const selected = getPaymentProvider(parsed.data.paymentProvider);
    const normalized = normalizeCreateOrderIdentity({
      tokenUserId: auth.user.uid,
      tokenUserEmail: auth.user.email,
      planCode: "plus",
      leaseProcessId: parsed.data.leaseProcessId,
    });
    const baseOrder = {
      id: orderRef.id,
      userId: normalized.userId,
      userEmail: normalized.userEmail,
      leaseProcessId: normalized.leaseProcessId,
      planCode: normalized.planCode,
      amount: normalized.amount,
      currency: normalized.currency,
      status: "created",
      paymentProvider: selected.providerCode,
      providerReference,
      checkoutUrl: "",
      createdAt: now,
      updatedAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
    } as const;

    const checkout = await selected.provider.createCheckout(baseOrder);
    await orderRef.set({
      ...baseOrder,
      providerReference: checkout.providerReference,
      checkoutUrl: checkout.checkoutUrl,
      status: "pending",
    });

    await auditPlatformPaymentEvent(firestore, "platform_order_created", {
      orderId: orderRef.id,
      userId: auth.user.uid,
      userEmail: auth.user.email,
      planCode: "plus",
      amount: PLATFORM_PLAN_PLUS_PRICE_COP,
      provider: selected.providerCode,
      ipAddress: requestClientIp(request),
      userAgent: requestUserAgent(request),
    });
    await auditPlatformPaymentEvent(firestore, "platform_checkout_created", {
      orderId: orderRef.id,
      providerReference: checkout.providerReference,
      provider: selected.providerCode,
    });

    return NextResponse.json({
      success: true,
      orderId: orderRef.id,
      checkoutUrl: checkout.checkoutUrl,
      status: "pending",
      amount: PLATFORM_PLAN_PLUS_PRICE_COP,
      currency: "COP",
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo crear la orden de pago." }] },
      { status: 500 },
    );
  }
}

