import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActivePlusEntitlementForUser } from "@/domain/platform-payments/entitlements";
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
    const entitlement = await getActivePlusEntitlementForUser(firestore, auth.user.uid);
    if (!entitlement) {
      await auditPlatformPaymentEvent(firestore, "access_blocked_no_plus_plan", {
        userId: auth.user.uid,
        userEmail: auth.user.email,
      });
      return NextResponse.json(
        { success: false, errors: [{ field: "access", message: "Para crear un contrato real debes activar el Plan Plus." }] },
        { status: 403 },
      );
    }
    const nextUsed = entitlement.contractsUsed + 1;
    const nextStatus = nextUsed >= entitlement.maxContractsAllowed ? "used" : "active";
    await firestore.collection("access_entitlements").doc(entitlement.id).set(
      {
        contractsUsed: nextUsed,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await auditPlatformPaymentEvent(firestore, "access_entitlement_used", {
      entitlementId: entitlement.id,
      userId: auth.user.uid,
      contractsUsed: nextUsed,
      maxContractsAllowed: entitlement.maxContractsAllowed,
    });
    return NextResponse.json({ success: true, entitlementId: entitlement.id, contractsUsed: nextUsed });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo consumir acceso Plus." }] },
      { status: 500 },
    );
  }
}

