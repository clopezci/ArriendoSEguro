import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser, requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { PLATFORM_PLAN_PLUS_PRICE_COP } from "@/domain/platform-payments/plans";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";

export const runtime = "nodejs";

const schema = z.object({ orderId: z.string().min(3) });

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
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "Endpoint mock no disponible en producción." }] },
      { status: 403 },
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
    const orderRef = firestore.collection("platform_orders").doc(parsed.data.orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "orderId", message: "Orden no encontrada." }] }, { status: 404 });
    }
    const order = orderSnap.data() as {
      id: string;
      userId: string;
      userEmail: string;
      planCode: string;
      amount: number;
      currency: string;
      status: string;
      leaseProcessId?: string | null;
      paymentProvider?: "mock" | "wompi";
    };
    if (order.userId !== auth.user.uid) {
      await auditPlatformPaymentEvent(firestore, "payment_report_blocked_unauthorized", {
        action: "platform_mock_approve",
        orderId: order.id,
        userId: auth.user.uid,
      });
      return NextResponse.json({ success: false, errors: [{ field: "auth", message: "Orden no autorizada para este usuario." }] }, { status: 403 });
    }
    if (order.planCode !== "plus") {
      return NextResponse.json({ success: false, errors: [{ field: "planCode", message: "Solo se puede aprobar orden del Plan Plus." }] }, { status: 422 });
    }

    const now = new Date().toISOString();
    await orderRef.set(
      { status: "approved", updatedAt: now, updatedAtServer: FieldValue.serverTimestamp() },
      { merge: true },
    );

    const paymentRef = firestore.collection("platform_payments").doc();
    await paymentRef.set({
      id: paymentRef.id,
      orderId: order.id,
      userId: order.userId,
      userEmail: order.userEmail,
      provider: order.paymentProvider ?? "mock",
      providerPaymentId: `mock_pay_${paymentRef.id}`,
      amount: order.amount,
      currency: order.currency,
      status: "approved",
      paymentMethod: "mock_checkout",
      rawProviderResponse: JSON.stringify({ source: "mock-approve" }),
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

    await auditPlatformPaymentEvent(firestore, "platform_payment_mock_approved", {
      orderId: order.id,
      paymentId: paymentRef.id,
      amount: PLATFORM_PLAN_PLUS_PRICE_COP,
      userId: order.userId,
      userEmail: order.userEmail,
      ipAddress: requestClientIp(request),
      userAgent: requestUserAgent(request),
    });
    await auditPlatformPaymentEvent(firestore, "platform_payment_approved", {
      orderId: order.id,
      paymentId: paymentRef.id,
    });
    await auditPlatformPaymentEvent(firestore, "access_entitlement_created", {
      entitlementId: entitlementRef.id,
      userId: order.userId,
      planCode: "plus",
    });

    return NextResponse.json({ success: true, orderStatus: "approved", entitlementId: entitlementRef.id });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo aprobar mock payment." }] },
      { status: 500 },
    );
  }
}

