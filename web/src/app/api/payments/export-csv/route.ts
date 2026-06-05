import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import type { PaymentLog } from "@/domain/payments/types";
import {
  filterPaymentsForCertificate,
  paymentsToCsv,
  type CertifiablePayment,
} from "@/domain/payments/paymentsCertificate";

export const runtime = "nodejs";

function toCertifiable(p: PaymentLog): CertifiablePayment {
  return {
    periodLabel: p.periodLabel,
    dueDate: p.dueDate,
    paidDate: p.paidDate,
    amountDue: Number(p.amountDue) || 0,
    amountPaid: Number(p.amountPaid) || 0,
    paymentMethod: p.paymentMethod,
    paymentStatus: p.paymentStatus,
    notes: p.notes,
    uploadedByTenantLink: (p as { uploadedByTenantLink?: boolean }).uploadedByTenantLink,
    ownerConfirmed: (p as { ownerConfirmed?: boolean }).ownerConfirmed,
  };
}

/** Exporta en CSV los pagos registrados del contrato (opcionalmente por año). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const contractId = url.searchParams.get("contractId") ?? "";
  const contractVersionId = url.searchParams.get("contractVersionId") ?? "";
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  if (!contractId || !contractVersionId) {
    return NextResponse.json(
      { success: false, errors: [{ field: "query", message: "contractId y contractVersionId son obligatorios." }] },
      { status: 422 },
    );
  }

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const participant = await requireContractParticipant(request, firestore, contractId, {
    kind: "by_version",
    contractVersionId,
  });
  if (!participant.ok) return participant.response;

  const snap = await firestore
    .collection("payments_log")
    .where("contractId", "==", contractId)
    .where("contractVersionId", "==", contractVersionId)
    .get();
  const all = snap.docs.map((d) => toCertifiable(d.data() as PaymentLog));
  const filtered = filterPaymentsForCertificate(all, Number.isFinite(year) ? year : undefined);
  const csv = paymentsToCsv(filtered);

  const suffix = Number.isFinite(year) ? `-${year}` : "";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pagos-registrados${suffix}.csv"`,
      "cache-control": "no-store",
    },
  });
}
