import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getLandlord } from "@/lib/agencies/agencyStore";
import { getSubmission, setSubmissionStatus } from "@/lib/agencies/intakeStore";
import {
  buildLeasePayloadFromRow,
  createAgencyContract,
  CONTRACTS_COLLECTION,
  type BulkContractRow,
} from "@/lib/agencies/agencyContracts";
import { validateContractData } from "@/domain/contracts/validateContractData";
import { renderResidentialLeaseDispatch } from "@/domain/contracts/renderResidentialLeaseDispatch";

export const runtime = "nodejs";

const schema = z.object({
  landlordId: z.string().trim().min(1),
  property: z.object({
    address: z.string().trim().min(3),
    city: z.string().trim().min(2),
    department: z.string().trim().min(2),
    type: z.string().trim().min(2),
    registryNumber: z.string().trim().optional(),
    commercialValue: z.number().int().min(0).optional(),
  }),
  lease: z.object({
    monthlyRent: z.number().int().min(1),
    paymentDueDay: z.number().int().min(1).max(31),
    paymentMethod: z.string().trim().optional(),
    startDate: z.string().trim().min(1),
    termMonths: z.number().int().min(1).max(120),
  }),
});

/**
 * POST /api/agency/[agencyId]/submissions/[submissionId]/generate
 * Genera un contrato borrador desde una solicitud (datos del inquilino ya
 * capturados) + arrendador/inmueble/canon que completa la agencia. Marca la
 * solicitud como usada y arrastra la verificación de identidad si la había.
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string; submissionId: string }> }) {
  const { agencyId, submissionId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const { firestore } = gate;

  const sub = await getSubmission(firestore, submissionId);
  if (!sub || sub.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "submissionId", message: "Solicitud no encontrada." }] }, { status: 404 });
  }
  if (sub.status !== "pending") {
    return NextResponse.json({ success: false, errors: [{ field: "submissionId", message: "La solicitud ya fue procesada." }] }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) }, { status: 422 });
  }

  const landlord = await getLandlord(firestore, parsed.data.landlordId);
  if (!landlord || landlord.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "landlordId", message: "Arrendador no encontrado." }] }, { status: 404 });
  }

  const row: BulkContractRow = {
    tenant: { ...sub.tenant, notificationAddress: "" },
    property: {
      address: parsed.data.property.address,
      city: parsed.data.property.city,
      department: parsed.data.property.department,
      type: parsed.data.property.type,
      registryNumber: parsed.data.property.registryNumber,
      commercialValue: parsed.data.property.commercialValue,
    },
    lease: {
      monthlyRent: parsed.data.lease.monthlyRent,
      paymentDueDay: parsed.data.lease.paymentDueDay,
      paymentMethod: parsed.data.lease.paymentMethod,
      startDate: parsed.data.lease.startDate,
      termMonths: parsed.data.lease.termMonths,
    },
  };

  const payload = buildLeasePayloadFromRow(landlord.party, row);
  const validation = validateContractData(payload);
  if (!validation.ok) {
    return NextResponse.json({ success: false, errors: validation.issues }, { status: 422 });
  }

  try {
    const rendered = renderResidentialLeaseDispatch(payload);
    const created = await createAgencyContract(firestore, {
      agencyId,
      landlordId: landlord.id,
      payload: { ...payload, generatedAt: rendered.generatedAt },
      html: rendered.html,
      documentHash: rendered.documentHash,
      createdByUid: gate.user.uid,
      createdByEmail: gate.user.email,
    });
    // Arrastra la identidad de la solicitud al contrato (para el gate de firma).
    if (sub.identity) {
      await firestore.collection(CONTRACTS_COLLECTION).doc(created.contractId).set(
        {
          identityCheck: {
            approved: sub.identity.approved,
            confianza: sub.identity.confianza,
            nombreRegistrado: sub.identity.nombreRegistrado,
            checkedAt: sub.identity.checkedAt,
            byUid: gate.user.uid,
            fromIntake: true,
          },
        },
        { merge: true },
      );
    }
    await setSubmissionStatus(firestore, submissionId, "used", created.contractId);
    return NextResponse.json({ success: true, contractId: created.contractId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo generar el contrato.";
    return NextResponse.json({ success: false, errors: [{ field: "server", message }] }, { status: 500 });
  }
}
