import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { getLandlord } from "@/lib/agencies/agencyStore";
import {
  buildLeasePayloadFromRow,
  createAgencyContract,
  type BulkContractRow,
} from "@/lib/agencies/agencyContracts";
import { validateContractData } from "@/domain/contracts/validateContractData";
import { renderResidentialLeaseDispatch } from "@/domain/contracts/renderResidentialLeaseDispatch";
import { effectiveAgencyDefaults } from "@/domain/agencies/types";

export const runtime = "nodejs";
const MAX_ROWS = 100;

const rowSchema = z.object({
  tenant: z.object({
    fullName: z.string().trim().min(1),
    documentType: z.string().trim().min(1),
    documentNumber: z.string().trim().min(1),
    city: z.string().trim().min(1),
    email: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    notificationAddress: z.string().trim().optional().default(""),
  }),
  property: z.object({
    address: z.string().trim().min(1),
    city: z.string().trim().min(1),
    department: z.string().trim().min(1),
    type: z.string().trim().min(1),
    registryNumber: z.string().trim().optional(),
    commercialValue: z.number().optional(),
    alias: z.string().trim().optional(),
  }),
  lease: z.object({
    monthlyRent: z.number(),
    paymentDueDay: z.number(),
    paymentMethod: z.string().trim().optional(),
    startDate: z.string().trim().min(1),
    endDate: z.string().trim().optional(),
    termMonths: z.number(),
    latePaymentMonthsThreshold: z.number().optional(),
  }),
});

const bodySchema = z.object({
  landlordId: z.string().trim().min(1),
  rows: z.array(rowSchema).min(1).max(MAX_ROWS),
  /** Aceptación de responsabilidad para las filas sin valor comercial (se omite
   * el tope del 1%). Sin esto, esas filas se rechazan con su error. */
  noCapAcknowledged: z.boolean().optional(),
});

/**
 * POST /api/agency/[agencyId]/bulk — genera contratos en lote.
 * Por cada fila: construye el payload, valida, renderiza y persiste un borrador.
 * Devuelve el resultado por fila (ok + contractId, o los errores de validación).
 * NO consume créditos: el cobro es al iniciar la firma (otro corte).
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string }> }) {
  const { agencyId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: [{ field: "body", message: "JSON inválido." }] }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const landlord = await getLandlord(gate.firestore, parsed.data.landlordId);
  if (!landlord || landlord.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "landlordId", message: "Arrendador no encontrado." }] }, { status: 404 });
  }

  const results: {
    index: number;
    ok: boolean;
    contractId?: string;
    tenantName?: string;
    errors?: { field: string; message: string }[];
  }[] = [];

  const defaults = effectiveAgencyDefaults(gate.agency);
  for (let i = 0; i < parsed.data.rows.length; i++) {
    const row = parsed.data.rows[i] as BulkContractRow;
    try {
      const payload = buildLeasePayloadFromRow(landlord.party, row, defaults, {
        noCapAcknowledged: parsed.data.noCapAcknowledged === true,
      });
      const validation = validateContractData(payload);
      if (!validation.ok) {
        results.push({ index: i, ok: false, tenantName: row.tenant.fullName, errors: validation.issues });
        continue;
      }
      const rendered = renderResidentialLeaseDispatch(payload);
      const created = await createAgencyContract(gate.firestore, {
        agencyId,
        landlordId: landlord.id,
        payload: { ...payload, generatedAt: rendered.generatedAt },
        html: rendered.html,
        documentHash: rendered.documentHash,
        createdByUid: gate.user.uid,
        createdByEmail: gate.user.email,
      });
      results.push({ index: i, ok: true, contractId: created.contractId, tenantName: row.tenant.fullName });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo generar este contrato.";
      results.push({ index: i, ok: false, tenantName: row.tenant.fullName, errors: [{ field: "server", message }] });
    }
  }

  const created = results.filter((r) => r.ok).length;
  return NextResponse.json({ success: true, created, failed: results.length - created, results });
}
