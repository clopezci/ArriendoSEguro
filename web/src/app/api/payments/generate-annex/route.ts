import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { renderPaymentLogAnnex } from "@/domain/payments/renderPaymentLogAnnex";
import type { PaymentLog } from "@/domain/payments/types";
import { auditEvent } from "@/features/contracts/audit";

export const runtime = "nodejs";

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Datos inválidos." }] }, { status: 422 });
    }
    const firestore = getAdminFirestore();
    if (!firestore) return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });

    const versionSnap = await firestore.collection("contract_versions").doc(parsed.data.contractVersionId).get();
    if (!versionSnap.exists) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "Versión no existe." }] }, { status: 404 });
    }
    const version = versionSnap.data() as {
      contractId?: string;
      contractPayload?: {
        property?: { address?: string };
        landlord?: { fullName?: string };
        tenant?: { fullName?: string };
      };
    } | undefined;
    if (version?.contractId !== parsed.data.contractId) {
      return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "La versión no pertenece al contrato." }] }, { status: 422 });
    }
    const paymentsSnap = await firestore
      .collection("payments_log")
      .where("contractId", "==", parsed.data.contractId)
      .where("contractVersionId", "==", parsed.data.contractVersionId)
      .get();
    const payments = paymentsSnap.docs.map((d) => d.data() as PaymentLog);

    const rendered = renderPaymentLogAnnex({
      contractId: parsed.data.contractId,
      contractVersionId: parsed.data.contractVersionId,
      propertyAddress: version?.contractPayload?.property?.address ?? "Sin dirección",
      landlordName: version?.contractPayload?.landlord?.fullName ?? "Arrendador",
      tenantName: version?.contractPayload?.tenant?.fullName ?? "Arrendatario",
      payments,
    });
    const now = new Date().toISOString();
    await firestore.collection("contract_annexes").doc(`annex_payments_${parsed.data.contractId}_${parsed.data.contractVersionId}`).set(
      {
        id: `annex_payments_${parsed.data.contractId}_${parsed.data.contractVersionId}`,
        contractId: parsed.data.contractId,
        contractVersionId: parsed.data.contractVersionId,
        leaseProcessId: parsed.data.contractId,
        annexType: "payment_log",
        title: "Anexo No. 3 - Registro de pagos",
        status: payments.length > 0 ? "generated" : "pending",
        htmlContent: rendered.html,
        pdfUrl: null,
        documentHash: rendered.hash,
        createdAt: now,
        updatedAt: now,
        generatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    auditEvent("payment_log_annex_generated", { contractId: parsed.data.contractId });
    return NextResponse.json({ success: true, documentHash: rendered.hash });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo generar anexo de pagos." }] }, { status: 500 });
  }
}

