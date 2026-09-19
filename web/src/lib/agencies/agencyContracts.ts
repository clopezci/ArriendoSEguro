import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import type { PersonParty, ResidentialLeaseContractInput } from "@/domain/contracts/types";
import { getDefaultLeaseContractVersion } from "@/domain/contracts/leaseTemplateFlags";
import { pesosEnLetras } from "@/lib/nuevo/pesos-en-letras";

export const CONTRACTS_COLLECTION = "contracts";
export const CONTRACT_VERSIONS_COLLECTION = "contract_versions";

/** Estado de cartera visible para la agencia. */
export type AgencyContractStatus = "draft" | "sent" | "signed";

/** Fila de datos para generar UN contrato en lote. */
export interface BulkContractRow {
  tenant: PersonParty;
  property: {
    address: string;
    city: string;
    department: string;
    type: string;
    registryNumber?: string;
    /** Valor comercial (para el tope del 1%). Si falta, se marca desconocido. */
    commercialValue?: number;
    alias?: string;
  };
  lease: {
    monthlyRent: number;
    paymentDueDay: number;
    paymentMethod?: string;
    startDate: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD (si falta, se calcula con termMonths)
    termMonths: number;
    latePaymentMonthsThreshold?: number;
  };
}

function addMonthsIso(startIso: string, months: number): string {
  const base = String(startIso).slice(0, 10);
  const [y, m, d] = base.split("-").map((n) => Number(n));
  if (!y || !m || !d) return base;
  const target = new Date(Date.UTC(y, m - 1 + months, d));
  return target.toISOString().slice(0, 10);
}

/**
 * Construye un `ResidentialLeaseContractInput` válido a partir del arrendador
 * reutilizable de la agencia y una fila de datos. Rellena valores por defecto
 * seguros (servicios a cargo del arrendatario, umbral de mora, versión activa)
 * y el canon en letras. Si no hay valor comercial, marca `commercialValueUnknown`
 * + `noCapAcknowledgement` (la agencia asume la responsabilidad del tope).
 */
export function buildLeasePayloadFromRow(landlord: PersonParty, row: BulkContractRow): ResidentialLeaseContractInput {
  const generatedAt = new Date().toISOString();
  const endDate = row.lease.endDate?.trim() || addMonthsIso(row.lease.startDate, row.lease.termMonths);
  const hasCommercialValue = typeof row.property.commercialValue === "number" && row.property.commercialValue > 0;

  return {
    landlord,
    tenant: row.tenant,
    property: {
      ...(row.property.alias ? { alias: row.property.alias } : {}),
      address: row.property.address,
      city: row.property.city,
      department: row.property.department,
      type: row.property.type,
      registryNumber: row.property.registryNumber ?? "",
      commercialValue: hasCommercialValue ? (row.property.commercialValue as number) : 0,
      legalRentCap: hasCommercialValue ? Math.round((row.property.commercialValue as number) * 0.01) : 0,
      ...(hasCommercialValue ? {} : { commercialValueUnknown: true, noCapAcknowledgement: true }),
    },
    lease: {
      monthlyRent: row.lease.monthlyRent,
      monthlyRentText: pesosEnLetras(row.lease.monthlyRent),
      paymentDueDay: row.lease.paymentDueDay,
      paymentMethod: row.lease.paymentMethod?.trim() || "Transferencia bancaria",
      startDate: String(row.lease.startDate).slice(0, 10),
      endDate,
      termMonths: row.lease.termMonths,
      latePaymentMonthsThreshold: row.lease.latePaymentMonthsThreshold ?? 2,
    },
    utilities: {
      responsibleParty: "Arrendatario",
      details: "Los servicios públicos domiciliarios están a cargo del arrendatario.",
      adminFeesDetails: "La cuota de administración/expensas está a cargo del arrendatario cuando aplique.",
    },
    hasSolidaryCoDebtor: false,
    contractVersion: getDefaultLeaseContractVersion(),
    generatedAt,
  };
}

export type CreateAgencyContractParams = {
  agencyId: string;
  landlordId?: string;
  propertyId?: string;
  payload: ResidentialLeaseContractInput;
  html: string;
  documentHash: string;
  createdByUid: string;
  createdByEmail: string;
};

/** Persiste un contrato de agencia (contracts + contract_versions). */
export async function createAgencyContract(
  firestore: Firestore,
  params: CreateAgencyContractParams,
): Promise<{ contractId: string; contractVersionId: string }> {
  const nowIso = new Date().toISOString();
  const contractRef = firestore.collection(CONTRACTS_COLLECTION).doc();
  const versionRef = firestore.collection(CONTRACT_VERSIONS_COLLECTION).doc();
  const p = params.payload;
  const propertyLabel = p.property.alias || `${p.property.address}, ${p.property.city}`;

  await contractRef.set({
    draftId: contractRef.id,
    status: "draft",
    hasSolidaryCoDebtor: p.hasSolidaryCoDebtor,
    currentVersionId: versionRef.id,
    currentVersionNumber: 1,
    renewalReminderEnabled: true,
    createdByUid: params.createdByUid,
    createdByEmail: params.createdByEmail,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    generatedAt: p.generatedAt,
    // --- Campos de agencia ---
    agencyId: params.agencyId,
    ...(params.landlordId ? { agencyLandlordId: params.landlordId } : {}),
    ...(params.propertyId ? { agencyPropertyId: params.propertyId } : {}),
    agencyStatus: "draft" as AgencyContractStatus,
    // Resumen para la cartera (evita leer cada versión al listar).
    tenantName: p.tenant.fullName,
    tenantEmail: p.tenant.email,
    propertyLabel,
    monthlyRent: p.lease.monthlyRent,
    startDate: p.lease.startDate,
    endDate: p.lease.endDate,
  });

  await versionRef.set({
    contractId: contractRef.id,
    contractDraftId: contractRef.id,
    versionNumber: 1,
    html: params.html,
    contractPayload: p,
    documentHash: params.documentHash,
    hasSolidaryCoDebtor: p.hasSolidaryCoDebtor,
    generatedAt: p.generatedAt,
    status: "draft",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: nowIso,
    immutable: true,
  });

  return { contractId: contractRef.id, contractVersionId: versionRef.id };
}

export interface AgencyContractSummary {
  contractId: string;
  currentVersionId: string | null;
  tenantName: string;
  tenantEmail: string;
  propertyLabel: string;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  agencyStatus: AgencyContractStatus;
  contractStatus: string;
  createdAtIso: string;
  /** Resultado de identidad: true=aprobado, false=reprobado, null=sin verificar. */
  identityApproved: boolean | null;
}

/** Lista los contratos de una agencia (cartera), más recientes primero. */
export async function listAgencyContracts(firestore: Firestore, agencyId: string): Promise<AgencyContractSummary[]> {
  const snap = await firestore.collection(CONTRACTS_COLLECTION).where("agencyId", "==", agencyId).limit(1000).get();
  const rows = snap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const idCheck = d.identityCheck as { approved?: boolean } | undefined;
    return {
      contractId: doc.id,
      currentVersionId: (d.currentVersionId as string) ?? null,
      tenantName: (d.tenantName as string) ?? "",
      tenantEmail: (d.tenantEmail as string) ?? "",
      propertyLabel: (d.propertyLabel as string) ?? "",
      monthlyRent: (d.monthlyRent as number) ?? 0,
      startDate: (d.startDate as string) ?? "",
      endDate: (d.endDate as string) ?? "",
      agencyStatus: ((d.agencyStatus as AgencyContractStatus) ?? "draft"),
      contractStatus: (d.status as string) ?? "draft",
      createdAtIso: (d.createdAtIso as string) ?? "",
      identityApproved: idCheck && typeof idCheck.approved === "boolean" ? idCheck.approved : null,
    } satisfies AgencyContractSummary;
  });
  rows.sort((a, b) => (a.createdAtIso < b.createdAtIso ? 1 : -1));
  return rows;
}
