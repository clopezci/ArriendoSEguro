import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const paymentLogId = url.searchParams.get("paymentLogId") ?? "";
    if (!paymentLogId) {
      return NextResponse.json({ success: false, errors: [{ field: "paymentLogId", message: "paymentLogId obligatorio." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const snap = await firestore.collection("payments_log").doc(paymentLogId).get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "paymentLogId", message: "Pago no existe." }] }, { status: 404 });
    }
    return NextResponse.json({ success: true, payment: snap.data() });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cargar pago." }] }, { status: 500 });
  }
}

