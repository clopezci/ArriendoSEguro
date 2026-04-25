import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser, requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { auditPlatformPaymentEvent } from "@/domain/platform-payments/audit";

export const runtime = "nodejs";

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
    const now = new Date().toISOString();
    const existing = await firestore
      .collection("access_entitlements")
      .where("userId", "==", auth.user.uid)
      .where("planCode", "==", "basic_demo")
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json({ success: true, entitlement: existing.docs[0]?.data(), alreadyActive: true });
    }
    const ref = firestore.collection("access_entitlements").doc();
    const entitlement = {
      id: ref.id,
      userId: auth.user.uid,
      userEmail: auth.user.email,
      leaseProcessId: null,
      planCode: "basic_demo",
      accessType: "demo",
      status: "active",
      maxContractsAllowed: 0,
      contractsUsed: 0,
      validUntil: null,
      createdAt: now,
      updatedAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
    };
    await ref.set(entitlement);
    await auditPlatformPaymentEvent(firestore, "demo_access_started", {
      entitlementId: ref.id,
      userId: auth.user.uid,
      userEmail: auth.user.email,
      ipAddress: requestClientIp(request),
      userAgent: requestUserAgent(request),
    });
    await auditPlatformPaymentEvent(firestore, "access_entitlement_created", {
      entitlementId: ref.id,
      planCode: "basic_demo",
    });
    return NextResponse.json({ success: true, entitlement });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo activar demo." }] },
      { status: 500 },
    );
  }
}

