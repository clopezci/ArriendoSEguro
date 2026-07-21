import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";
import { brebLlave, brebMerchantName, isBrebConfigured } from "@/domain/platform-payments/breb-checkout";
import { isInternalAdminEmail } from "@/lib/admin/internal-admin";

export const runtime = "nodejs";

/**
 * Info para la página interna de pago Bre-B (QR/llave): monto, estado, llave del
 * comercio y nombre. Solo para el dueño de la orden.
 */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;
  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, error: "server_not_configured" }, { status: 503 });
  }
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  if (!reference) {
    return NextResponse.json({ success: false, error: "missing_reference" }, { status: 422 });
  }

  const snap = await firestore
    .collection("platform_orders")
    .where("providerReference", "==", reference)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return NextResponse.json({ success: false, error: "order_not_found" }, { status: 404 });
  const order = doc.data() as { id: string; userId: string; amount: number; currency: string; status: string };
  if (order.userId !== auth.user.uid) {
    return NextResponse.json({ success: false, error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    orderId: order.id,
    amountCop: Number(order.amount) || 0,
    currency: order.currency || "COP",
    status: order.status,
    llave: brebLlave(),
    merchantName: brebMerchantName(),
    // En modo interno (sin proveedor real), el pago se confirma manualmente / mock.
    internalMode: !isBrebConfigured(),
    devSimulate: process.env.NODE_ENV !== "production",
    // En producción + modo interno, el comercio (admin) puede confirmar "recibí el
    // pago" — Bre-B interno no tiene webhook que lo apruebe automáticamente.
    adminConfirm:
      process.env.NODE_ENV === "production" &&
      !isBrebConfigured() &&
      isInternalAdminEmail(auth.user.email),
  });
}
