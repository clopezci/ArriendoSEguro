import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireContractParticipant } from "@/lib/auth/serverAuth";

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
    const payment = snap.data();
    const pRow = payment as { contractId?: string; contractVersionId?: string } | undefined;
    const contractId = (pRow?.contractId ?? "").trim();
    const contractVersionId = (pRow?.contractVersionId ?? "").trim();
    if (contractId && contractVersionId) {
      const gate = await requireContractParticipant(request, firestore, contractId, {
        kind: "by_version",
        contractVersionId,
      });
      if (!gate.ok) return gate.response;
    } else {
      const auth = await requireAuthenticatedUser(request);
      if (!auth.ok) return auth.response;
    }
    const historySnap = await firestore
      .collection("audit_logs")
      .where("paymentLogId", "==", paymentLogId)
      .get();
    return NextResponse.json({
      success: true,
      payment,
      history: historySnap.docs.map((d) => d.data()),
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cargar pago." }] }, { status: 500 });
  }
}

