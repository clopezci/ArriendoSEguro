import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  paymentCreateSchema,
  validatePaymentBusinessRules,
} from "@/domain/payments/validatePaymentLog";
import { computePaymentStatus } from "@/domain/payments/paymentStatus";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = paymentCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
        { status: 422 },
      );
    }
    const issues = validatePaymentBusinessRules({
      amountDue: parsed.data.amountDue,
      amountPaid: parsed.data.amountPaid,
    });
    if (issues.length) return NextResponse.json({ success: false, errors: issues }, { status: 422 });

    const firestore = getAdminFirestore();
    if (!firestore) {
      return NextResponse.json(
        { success: false, errors: [{ field: "server", message: "Firestore no configurado." }] },
        { status: 503 },
      );
    }
    const versionSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
    if (!versionSnap.exists) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractVersionId", message: "Versión no encontrada." }] },
        { status: 404 },
      );
    }
    const v = versionSnap.data() as { contractId?: string } | undefined;
    if (v?.contractId !== parsed.data.contractId) {
      return NextResponse.json(
        { success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] },
        { status: 422 },
      );
    }

    const status = computePaymentStatus({
      dueDate: parsed.data.dueDate,
      paidDate: parsed.data.paidDate,
      amountDue: parsed.data.amountDue,
      amountPaid: parsed.data.amountPaid,
    });
    const ref = firestore.collection("payments_log").doc();
    const now = new Date().toISOString();
    await ref.set({
      id: ref.id,
      ...parsed.data,
      registeredByUserId: "TODO_AUTH_USER",
      paymentStatus: status,
      createdAt: now,
      updatedAt: now,
      createdAtServer: FieldValue.serverTimestamp(),
      updatedAtServer: FieldValue.serverTimestamp(),
    });
    if (parsed.data.supportFileUrl) {
      await firestore.collection("payment_support_files").doc().set({
        id: `psf_${Date.now()}`,
        paymentLogId: ref.id,
        fileName: parsed.data.supportFileUrl.split("/").pop() ?? "soporte",
        fileUrl: parsed.data.supportFileUrl,
        fileType: "unknown",
        uploadedByUserId: "TODO_AUTH_USER",
        uploadedAt: now,
      });
    }
    auditEvent("payment_log_created", { paymentLogId: ref.id, contractId: parsed.data.contractId });
    return NextResponse.json({ success: true, paymentLogId: ref.id, paymentStatus: status });
  } catch {
    return NextResponse.json(
      { success: false, errors: [{ field: "server", message: "No se pudo crear el pago." }] },
      { status: 500 },
    );
  }
}

