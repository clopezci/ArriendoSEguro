import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const contractId = url.searchParams.get("contractId") ?? "";
    const contractVersionId = url.searchParams.get("contractVersionId") ?? "";
    if (!contractId || !contractVersionId) {
      return NextResponse.json({ success: false, errors: [{ field: "query", message: "contractId y contractVersionId son obligatorios." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: true, scheduledPayments: [], reminderSettings: null });
    const gate = await requireContractParticipant(request, firestore, contractId, {
      kind: "by_version",
      contractVersionId,
    });
    if (!gate.ok) return gate.response;
    const [scheduleSnap, settingsSnap] = await Promise.all([
      firestore.collection("scheduled_payments").where("contractId", "==", contractId).where("contractVersionId", "==", contractVersionId).get(),
      firestore.collection("payment_reminder_settings").doc(`prs_${contractId}`).get(),
    ]);
    const nowMs = Date.now();
    await Promise.all(
      scheduleSnap.docs.map(async (d) => {
        const row = d.data() as { status?: string; dueDate?: string; paymentLogId?: string };
        if (
          (row.status === "scheduled" || row.status === "pending") &&
          !row.paymentLogId &&
          row.dueDate &&
          new Date(row.dueDate).getTime() < nowMs
        ) {
          await d.ref.set({ status: "late", updatedAt: new Date().toISOString() }, { merge: true });
        }
      }),
    );
    const refreshed = await firestore
      .collection("scheduled_payments")
      .where("contractId", "==", contractId)
      .where("contractVersionId", "==", contractVersionId)
      .get();
    return NextResponse.json({
      success: true,
      myRole: gate.role,
      scheduledPayments: refreshed.docs.map((d) => d.data()),
      reminderSettings: settingsSnap.exists ? settingsSnap.data() : null,
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo cargar calendario." }] }, { status: 500 });
  }
}

