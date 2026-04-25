import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { markDisputedSchema } from "@/domain/payments/validatePaymentLog";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = markDisputedSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Datos inválidos." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const payRef = firestore.collection("payments_log").doc(parsed.data.paymentLogId);
    const snap = await payRef.get();
    if (!snap.exists) return NextResponse.json({ success: false, errors: [{ field: "paymentLogId", message: "Pago no existe." }] }, { status: 404 });
    const now = new Date().toISOString();
    await payRef.set(
      {
        paymentStatus: "disputed",
        notes: `${(snap.data() as { notes?: string } | undefined)?.notes ?? ""}\nDisputa: ${parsed.data.reason}`,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await firestore.collection("audit_logs").add({
      event: "payment_marked_disputed",
      paymentLogId: parsed.data.paymentLogId,
      reason: parsed.data.reason,
      actor: "TODO_AUTH_USER",
      at: now,
    });
    auditEvent("payment_marked_disputed", { paymentLogId: parsed.data.paymentLogId });
    return NextResponse.json({ success: true, paymentStatus: "disputed" });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo marcar disputa." }] }, { status: 500 });
  }
}

