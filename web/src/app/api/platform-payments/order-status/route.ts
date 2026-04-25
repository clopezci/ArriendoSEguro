import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { getAdminFirestore } from "@/lib/firebase/admin";

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
    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId") ?? "";
    if (!orderId) {
      return NextResponse.json(
        { success: false, errors: [{ field: "orderId", message: "orderId es obligatorio." }] },
        { status: 422 },
      );
    }
    const orderSnap = await firestore.collection("platform_orders").doc(orderId).get();
    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "orderId", message: "Orden no encontrada." }] }, { status: 404 });
    }
    const order = orderSnap.data() as { userId?: string; status?: string };
    if (order.userId !== auth.user.uid) {
      return NextResponse.json({ success: false, errors: [{ field: "auth", message: "Orden no autorizada." }] }, { status: 403 });
    }
    const entitlementSnap = await firestore
      .collection("access_entitlements")
      .where("userId", "==", auth.user.uid)
      .where("planCode", "==", "plus")
      .where("status", "==", "active")
      .limit(1)
      .get();
    return NextResponse.json({
      success: true,
      order: orderSnap.data(),
      accessEntitlement: entitlementSnap.empty ? null : entitlementSnap.docs[0]?.data(),
    });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo consultar estado de orden." }] },
      { status: 500 },
    );
  }
}

