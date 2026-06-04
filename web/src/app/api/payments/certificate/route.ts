import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requireContractParticipant } from "@/lib/auth/serverAuth";
import type { PaymentLog } from "@/domain/payments/types";
import {
  filterPaymentsForCertificate,
  renderPaymentsCertificateHtml,
  type CertifiablePayment,
} from "@/domain/payments/paymentsCertificate";
import { renderContractPdfFromHtml } from "@/domain/contracts/pdf";
import { generateDocumentHash } from "@/domain/contracts/hash";
import { auditEvent } from "@/features/contracts/audit-server";

export const runtime = "nodejs";

const schema = z.object({
  contractId: z.string().min(3),
  contractVersionId: z.string().min(3),
  year: z.number().int().min(2000).max(2100).optional(),
});

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
  };
}

/** Genera el "Certificado de pagos registrados" (PDF neutral) y lo devuelve para descargar. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: [{ field: "payload", message: "Datos inválidos." }] }, { status: 422 });
  }
  const { contractId, contractVersionId, year } = parsed.data;

  const firestore = getAdminFirestore();
  if (!firestore) {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "Firestore no configurado." }] }, { status: 503 });
  }

  const participant = await requireContractParticipant(request, firestore, contractId, {
    kind: "by_version",
    contractVersionId,
  });
  if (!participant.ok) return participant.response;

  const versionSnap = await firestore.collection("contract_versions").doc(contractVersionId).get();
  const version = versionSnap.exists
    ? (versionSnap.data() as {
        contractId?: string;
        versionNumber?: number;
        contractPayload?: { property?: { address?: string }; landlord?: { fullName?: string }; tenant?: { fullName?: string } };
      })
    : undefined;
  if (!version || version.contractId !== contractId) {
    return NextResponse.json({ success: false, errors: [{ field: "contractVersionId", message: "Versión no válida." }] }, { status: 422 });
  }

  const snap = await firestore
    .collection("payments_log")
    .where("contractId", "==", contractId)
    .where("contractVersionId", "==", contractVersionId)
    .get();
  const payments = filterPaymentsForCertificate(
    snap.docs.map((d) => toCertifiable(d.data() as PaymentLog)),
    year,
  );

  const generatedAt = new Date().toISOString();
  const html = renderPaymentsCertificateHtml({
    contractId,
    propertyAddress: version.contractPayload?.property?.address ?? "Sin dirección",
    landlordName: version.contractPayload?.landlord?.fullName ?? "Arrendador",
    tenantName: version.contractPayload?.tenant?.fullName ?? "Arrendatario",
    year,
    payments,
    generatedAt,
  });
  const documentHash = generateDocumentHash(html);

  try {
    const pdfBytes = await renderContractPdfFromHtml({
      html,
      contractId,
      contractVersionId,
      versionNumber: version.versionNumber ?? 1,
      documentHash,
      generatedAt,
    });
    auditEvent("payments_certificate_generated", { contractId, year: year ?? null, count: payments.length });
    const suffix = year ? `-${year}` : "";
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="certificado-pagos${suffix}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "server", message: "No se pudo generar el certificado." }] }, { status: 500 });
  }
}
