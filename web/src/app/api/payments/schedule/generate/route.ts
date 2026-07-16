import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { scheduleGenerateSchema } from "@/domain/payments/validatePaymentLog";
import { generatePaymentSchedule } from "@/domain/payments/generatePaymentSchedule";
import { auditEvent } from "@/features/contracts/audit-server";
import { requireContractParticipant } from "@/lib/auth/serverAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = scheduleGenerateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 422 },
      );
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
    const gate = await requireContractParticipant(request, firestore, parsed.data.contractId, {
      kind: "by_version",
      contractVersionId: parsed.data.contractVersionId,
    });
    if (!gate.ok) return gate.response;
    const versionSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
    if (!versionSnap.exists) return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "Versión no existe." }] }, { status: 404 });
    const version = versionSnap.data() as {
      contractId?: string;
      contractPayload?: { lease?: { startDate?: string; termMonths?: number; monthlyRent?: number; paymentDueDay?: number }; tenant?: { email?: string }; landlord?: { email?: string } };
    } | undefined;
    if (version?.contractId !== parsed.data.contractId) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] }, { status: 422 });
    }
    const lease = version?.contractPayload?.lease;
    if (!lease?.startDate || !lease.termMonths || !lease.monthlyRent || !lease.paymentDueDay) {
      return NextResponse.json({ success: false, errors: [{ field: "leaseTerms", message: "Faltan términos del contrato para calendario." }] }, { status: 422 });
    }

    const scheduleRows = generatePaymentSchedule({
      startDate: lease.startDate,
      termMonths: lease.termMonths,
      monthlyRent: lease.monthlyRent,
      paymentDueDay: lease.paymentDueDay,
    });
    if (scheduleRows.length === 0) {
      return NextResponse.json({ success: false, errors: [{ field: "schedule", message: "No se pudo generar calendario." }] }, { status: 422 });
    }

    const existing = await firestore
      .collection("scheduled_payments")
      .where("contractId", "==", parsed.data.contractId)
      .where("contractVersionId", "==", parsed.data.contractVersionId)
      .get();
    const now = new Date().toISOString();
    const batch = firestore.batch();
    const existingByPeriod = new Map(
      existing.docs.map((d) => {
        const row = d.data() as { periodNumber?: number };
        return [row.periodNumber ?? -1, d];
      }),
    );

    scheduleRows.forEach((row) => {
      const existingDoc = existingByPeriod.get(row.periodNumber);
      const ref = existingDoc?.ref ?? firestore.collection("scheduled_payments").doc();
      batch.set(
        ref,
        {
          id: ref.id,
          leaseProcessId: parsed.data.leaseProcessId,
          contractId: parsed.data.contractId,
          contractVersionId: parsed.data.contractVersionId,
          periodNumber: row.periodNumber,
          periodLabel: row.periodLabel,
          dueDate: row.dueDate,
          expectedAmount: row.expectedAmount,
          status: existingDoc?.data().status ?? "scheduled",
          paymentLogId: existingDoc?.data().paymentLogId ?? null,
          reminderEnabled: parsed.data.reminderSettings?.enabled ?? true,
          reminderDaysBefore: parsed.data.reminderSettings?.defaultDaysBefore ?? 3,
          reminderEmailTo:
            parsed.data.reminderSettings?.tenantEmail ??
            version?.contractPayload?.tenant?.email ??
            "",
          reminderLastSentAt: existingDoc?.data().reminderLastSentAt ?? null,
          reminderStatus:
            parsed.data.reminderSettings?.enabled === false ? "disabled" : "scheduled",
          createdAt: existingDoc?.data().createdAt ?? now,
          updatedAt: now,
          updatedAtServer: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();

    const settingsRef = firestore.collection("payment_reminder_settings").doc(`prs_${parsed.data.contractId}`);
    await settingsRef.set(
      {
        id: settingsRef.id,
        leaseProcessId: parsed.data.leaseProcessId,
        contractId: parsed.data.contractId,
        enabled: parsed.data.reminderSettings?.enabled ?? true,
        defaultDaysBefore: parsed.data.reminderSettings?.defaultDaysBefore ?? 3,
        tenantEmail: parsed.data.reminderSettings?.tenantEmail ?? version?.contractPayload?.tenant?.email ?? "",
        landlordCopyEnabled: parsed.data.reminderSettings?.landlordCopyEnabled ?? false,
        landlordEmail: parsed.data.reminderSettings?.landlordEmail ?? version?.contractPayload?.landlord?.email ?? "",
        customMessage: parsed.data.reminderSettings?.customMessage ?? "",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    auditEvent(existing.empty ? "payment_schedule_generated" : "payment_schedule_regenerated", {
      contractId: parsed.data.contractId,
      rows: scheduleRows.length,
    });
    return NextResponse.json({ success: true, generated: scheduleRows.length });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo generar calendario." }] }, { status: 500 });
  }
}

