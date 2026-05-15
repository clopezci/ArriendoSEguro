import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { scheduleSettingsSchema } from "@/domain/payments/validatePaymentLog";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = scheduleSettingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const now = new Date().toISOString();
    const settingsRef = firestore.collection("payment_reminder_settings").doc(`prs_${parsed.data.contractId}`);
    await settingsRef.set({ id: settingsRef.id, ...parsed.data, updatedAt: now, createdAt: now }, { merge: true });
    const scheduleSnap = await firestore.collection("scheduled_payments").where("contractId", "==", parsed.data.contractId).get();
    await Promise.all(
      scheduleSnap.docs.map((d) =>
        d.ref.set(
          {
            reminderEnabled: parsed.data.enabled,
            reminderDaysBefore: parsed.data.defaultDaysBefore,
            reminderEmailTo: parsed.data.tenantEmail,
            reminderStatus: parsed.data.enabled ? "scheduled" : "disabled",
            updatedAt: now,
          },
          { merge: true },
        ),
      ),
    );
    auditEvent("payment_reminder_settings_updated", { contractId: parsed.data.contractId });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo actualizar configuración." }] }, { status: 500 });
  }
}

