import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyMember } from "@/lib/auth/requireAgencyMember";
import { createAgencyContract, CONTRACTS_COLLECTION, CONTRACT_VERSIONS_COLLECTION } from "@/lib/agencies/agencyContracts";
import { validateContractData } from "@/domain/contracts/validateContractData";
import { renderResidentialLeaseDispatch } from "@/domain/contracts/renderResidentialLeaseDispatch";
import { pesosEnLetras } from "@/lib/nuevo/pesos-en-letras";
import { getLegalConfig } from "@/domain/legal/legalConfig";
import type { ResidentialLeaseContractInput } from "@/domain/contracts/types";

export const runtime = "nodejs";

function addMonthsIso(startIso: string, months: number): string {
  const base = String(startIso).slice(0, 10);
  const [y, m, d] = base.split("-").map((n) => Number(n));
  if (!y || !m || !d) return base;
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

const bodySchema = z.object({
  /** Canon nuevo (COP). Si falta, se calcula con el IPC legal vigente. */
  monthlyRent: z.number().int().min(1).max(1_000_000_000).optional(),
  /** Fecha de inicio de la renovación. Si falta, el día siguiente al fin anterior. */
  startDate: z.string().trim().optional(),
  /** Duración en meses. Si falta, la del contrato anterior. */
  termMonths: z.number().int().min(1).max(120).optional(),
});

/**
 * POST /api/agency/[agencyId]/contracts/[contractId]/renew — genera un contrato
 * NUEVO (borrador) clonando el anterior: mismas partes e inmueble, con fechas
 * corridas y canon ajustado (IPC legal, o el que envíe la agencia). No consume
 * crédito (el cobro es al enviar a firma).
 */
export async function POST(request: Request, { params }: { params: Promise<{ agencyId: string; contractId: string }> }) {
  const { agencyId, contractId } = await params;
  const gate = await requireAgencyMember(request, agencyId);
  if (!gate.ok) return gate.response;
  const { firestore } = gate;

  let raw: unknown = {};
  try {
    raw = await request.json();
  } catch {
    /* body opcional */
  }
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 422 },
    );
  }

  const snap = await firestore.collection(CONTRACTS_COLLECTION).doc(contractId).get();
  const contract = snap.exists ? (snap.data() as Record<string, unknown>) : null;
  if (!contract || contract.agencyId !== agencyId) {
    return NextResponse.json({ success: false, errors: [{ field: "contractId", message: "Contrato no encontrado." }] }, { status: 404 });
  }
  const versionId = (contract.currentVersionId as string) ?? "";
  const vSnap = await firestore.collection(CONTRACT_VERSIONS_COLLECTION).doc(versionId).get();
  const prev = vSnap.exists ? (vSnap.data() as { contractPayload?: ResidentialLeaseContractInput }).contractPayload : null;
  if (!prev) {
    return NextResponse.json({ success: false, errors: [{ field: "version", message: "No se pudo leer el contrato anterior." }] }, { status: 404 });
  }

  // Fechas nuevas.
  const prevEnd = String(prev.lease.endDate).slice(0, 10);
  const startDate = parsed.data.startDate?.trim() ? parsed.data.startDate.slice(0, 10) : addMonthsIso(prevEnd, 0);
  const termMonths = parsed.data.termMonths ?? prev.lease.termMonths;
  const endDate = addMonthsIso(startDate, termMonths);

  // Canon nuevo: el enviado, o ajuste por IPC legal vigente.
  let newRent = parsed.data.monthlyRent;
  if (!newRent) {
    let ipcPercent = 0;
    try {
      ipcPercent = Number((await getLegalConfig(firestore)).ipcPercent) || 0;
    } catch {
      ipcPercent = 0;
    }
    newRent = Math.round(prev.lease.monthlyRent * (1 + ipcPercent / 100));
  }

  const payload: ResidentialLeaseContractInput = {
    ...prev,
    lease: {
      ...prev.lease,
      monthlyRent: newRent,
      monthlyRentText: pesosEnLetras(newRent),
      startDate,
      endDate,
      termMonths,
    },
    generatedAt: new Date().toISOString(),
  };

  const validation = validateContractData(payload);
  if (!validation.ok) {
    return NextResponse.json({ success: false, errors: validation.issues }, { status: 422 });
  }

  try {
    const rendered = renderResidentialLeaseDispatch(payload);
    const created = await createAgencyContract(firestore, {
      agencyId,
      landlordId: (contract.agencyLandlordId as string) || undefined,
      propertyId: (contract.agencyPropertyId as string) || undefined,
      payload: { ...payload, generatedAt: rendered.generatedAt },
      html: rendered.html,
      documentHash: rendered.documentHash,
      createdByUid: gate.user.uid,
      createdByEmail: gate.user.email,
    });
    return NextResponse.json({ success: true, contractId: created.contractId, monthlyRent: newRent, startDate, endDate });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo renovar.";
    return NextResponse.json({ success: false, errors: [{ field: "server", message }] }, { status: 500 });
  }
}
