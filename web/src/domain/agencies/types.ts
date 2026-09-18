import type { PersonParty } from "@/domain/contracts/types";

/**
 * Módulo Agencias — modelo de datos.
 *
 * Una **agencia** (arrendadora/inmobiliaria) agrupa varios inmuebles, arrendadores
 * y contratos, para trabajar en volumen. Cada contrato generado por una agencia
 * sigue siendo un contrato normal del sistema (mismo motor/firma/lifecycle), solo
 * que apunta a `agencyId` (+ `propertyId`). Así no se duplica lógica.
 *
 * Membresía (Fase 1): el acceso se concede si el correo del usuario está en
 * `memberEmails`, si es el `ownerUid`, o si es admin interno. Roles finos por
 * agente quedan para una fase posterior.
 */

export const AGENCIES_COLLECTION = "agencies";
export const AGENCY_LANDLORDS_COLLECTION = "agency_landlords";
export const AGENCY_PROPERTIES_COLLECTION = "agency_properties";
export const AGENCY_CREDITS_COLLECTION = "agency_credits";

export type AgencyStatus = "active" | "suspended";

export interface Agency {
  id: string;
  name: string;
  /** NIT o identificación de la agencia (opcional). */
  nit?: string;
  contactEmail: string;
  contactPhone?: string;
  /** Logo para marca ligera en el portal (fase posterior). */
  logoUrl?: string;
  /** Correos con acceso a la agencia (en minúscula). Fase 1 = membresía plana. */
  memberEmails: string[];
  /** Uid del usuario que creó/administra la agencia. */
  ownerUid: string;
  status: AgencyStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Arrendador reutilizable de una agencia: se teclea una sola vez y se reutiliza
 * en muchos contratos. Guarda un `PersonParty` compatible con el motor de
 * contratos para mapear sin fricción al generar.
 */
export interface AgencyLandlord {
  id: string;
  agencyId: string;
  party: PersonParty;
  createdAt: string;
  updatedAt: string;
}

/**
 * Inmueble reutilizable de una agencia. Guarda el subconjunto de `PropertyData`
 * necesario para generar el contrato; el tope legal (1%) se recalcula en el
 * servidor al generar, no se confía en lo almacenado.
 */
export interface AgencyProperty {
  id: string;
  agencyId: string;
  /** Alias interno para reconocer el inmueble ("Apto 302 Laureles"). */
  alias?: string;
  address: string;
  city: string;
  department: string;
  type: string;
  registryNumber: string;
  /** Valor comercial declarado (para el tope del 1%). */
  commercialValue?: number;
  commercialValueUnknown?: boolean;
  /** Canon sugerido por defecto para este inmueble (COP). */
  defaultRent?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Saldo de créditos prepago de la agencia. Un crédito se consume al iniciar la
 * firma de cada contrato (precio por volumen). Doc id = agencyId.
 */
export interface AgencyCredits {
  agencyId: string;
  /** Créditos disponibles (contratos que puede firmar). */
  balance: number;
  /** Total comprado histórico (auditoría). */
  totalPurchased: number;
  /** Total consumido histórico (auditoría). */
  totalConsumed: number;
  updatedAt: string;
}

export function normalizeAgencyEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** ¿El correo pertenece a la agencia (miembro)? No incluye admin interno. */
export function isAgencyMemberEmail(agency: Agency, email: string | null | undefined): boolean {
  const target = normalizeAgencyEmail(email);
  if (!target) return false;
  return agency.memberEmails.map(normalizeAgencyEmail).includes(target);
}
