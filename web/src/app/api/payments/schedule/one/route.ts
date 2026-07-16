import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireAuthenticatedUser, requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scheduledPaymentId = url.searchParams.get("scheduledPaymentId") ?? "";
    if (!scheduledPaymentId) {
      return NextResponse.json({ success: false, errors: [{ field: "scheduledPaymentId", message: "scheduledPaymentId obligatorio." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const snap = await firestore.collection("scheduled_payments").doc(scheduledPaymentId).get();
    if (!snap.exists) return NextResponse.json({ success: false, errors: [{ field: "scheduledPaymentId", message: "Pago programado no encontrado." }] }, { status: 404 });
    const row = snap.data() as { contractId?: string; contractVersionId?: string } | undefined;
    const contractId = (row?.contractId ?? "").trim();
    const contractVersionId = (row?.contractVersionId ?? "").trim();
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
    return NextResponse.json({ success: true, scheduledPayment: snap.data() });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cargar pago programado." }] }, { status: 500 });
  }
}

