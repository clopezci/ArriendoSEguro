import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getActiveDemoEntitlementForUser, getActivePlusEntitlementForUser } from "@/domain/platform-payments/entitlements";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
    const [plus, demo] = await Promise.all([
      getActivePlusEntitlementForUser(firestore, auth.user.uid),
      getActiveDemoEntitlementForUser(firestore, auth.user.uid),
    ]);
    return NextResponse.json({
      success: true,
      plusActive: Boolean(plus),
      demoActive: Boolean(demo),
      plusEntitlement: plus,
      demoEntitlement: demo,
      canCreateRealContract: Boolean(plus),
      canUseDemo: Boolean(demo),
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo consultar accesos." }] },
      { status: 500 },
    );
  }
}

