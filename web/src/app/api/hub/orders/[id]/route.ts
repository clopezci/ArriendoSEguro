import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { authenticateHubRequest } from "@/lib/hub/authenticateHubRequest";

export const runtime = "nodejs";

/** Estado de una orden del hub. Autenticado por API key + HMAC (cuerpo vacío). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "server_not_configured" }, { status: 503 });
  }

  const nowMs = Date.now();
  const auth = await authenticateHubRequest(firestore, request, "", nowMs);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  const snap = await firestore.collection("hub_orders").doc(id).get();
  const order = snap.exists ? (snap.data() as { appId?: string } & Record<string, unknown>) : null;
  // No revelar existencia de órdenes de otras apps.
  if (!order || order.appId !== auth.app.id) {
    return NextResponse.json({ success: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    order: {
      id: order.id,
      status: order.status,
      amountInCents: order.amountInCents,
      currency: order.currency,
      externalReference: order.externalReference,
      reference: order.providerReference,
      checkoutUrl: order.checkoutUrl,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
}
