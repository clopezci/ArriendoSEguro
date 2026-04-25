import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { updateScheduledOneSchema } from "@/domain/payments/validatePaymentLog";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = updateScheduledOneSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const ref = firestore.collection("scheduled_payments").doc(parsed.data.scheduledPaymentId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ success: false, errors: [{ field: "scheduledPaymentId", message: "Pago programado no existe." }] }, { status: 404 });
    await ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
    auditEvent("payment_schedule_item_updated", { scheduledPaymentId: parsed.data.scheduledPaymentId });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo actualizar pago programado." }] }, { status: 500 });
  }
}

