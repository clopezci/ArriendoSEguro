import type { PersonParty } from "@/domain/contracts/types";
import type { StudyRule } from "@/domain/agencies/studyRules";

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

/** Créditos gratuitos que recibe una agencia al registrarse sola (prueba). */
export const AGENCY_TRIAL_CREDITS = 3;

export type AgencyStatus = "active" | "suspended";

/** Cómo se dio de alta la agencia: manual (admin) o auto-registro público. */
export type AgencyOrigin = "admin" | "self_signup";

/** Valores por defecto que la agencia aplica a todos sus contratos. */
export interface AgencyContractDefaults {
  /** Política de comprobante/recordatorios de pago (recordatorios ON por defecto). */
  paymentSupportPolicy: "none" | "notifications" | "notifications_and_upload";
  /** Responsable de servicios públicos. */
  utilitiesResponsible: string;
  /** Detalle de servicios públicos. */
  utilitiesDetails: string;
  /** Detalle de administración/expensas. */
  adminFeesDetails: string;
}

export const DEFAULT_AGENCY_CONTRACT_DEFAULTS: AgencyContractDefaults = {
  paymentSupportPolicy: "notifications",
  utilitiesResponsible: "Arrendatario",
  utilitiesDetails: "Los servicios públicos domiciliarios están a cargo del arrendatario.",
  adminFeesDetails: "La cuota de administración/expensas está a cargo del arrendatario cuando aplique.",
};

export type IntakeFieldType = "text" | "number" | "bool" | "select";

/** Campo personalizado que la agencia agrega a su formulario de captura. */
export interface IntakeFieldDef {
  /** Clave estable (slug) para guardar el valor. */
  key: string;
  label: string;
  type: IntakeFieldType;
  /** Opciones para type "select". */
  options?: string[];
  required?: boolean;
}

function slugifyFieldKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "campo";
}

/** Normaliza y acota los campos personalizados (máx 12, claves únicas). */
export function sanitizeIntakeFields(input: unknown): IntakeFieldDef[] {
  if (!Array.isArray(input)) return [];
  const out: IntakeFieldDef[] = [];
  const used = new Set<string>();
  for (const raw of input.slice(0, 12)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 80) : "";
    if (!label) continue;
    const type: IntakeFieldType = (["text", "number", "bool", "select"] as const).includes(r.type as IntakeFieldType)
      ? (r.type as IntakeFieldType)
      : "text";
    let key = typeof r.key === "string" && r.key.trim() ? slugifyFieldKey(r.key) : slugifyFieldKey(label);
    while (used.has(key)) key = `${key}_2`;
    used.add(key);
    const options =
      type === "select" && Array.isArray(r.options)
        ? r.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim().slice(0, 60)).slice(0, 20)
        : undefined;
    out.push({ key, label, type, required: r.required === true, ...(options && options.length ? { options } : {}) });
  }
  return out;
}

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
  /**
   * Correo de ESCALAMIENTO/PQR de la agencia (obligatorio). El hub de identidad
   * enruta ahí los casos de fraude/suplantación. Sin él, esos casos quedan en el
   * limbo, por eso es requerido al crear la agencia.
   */
  escalationEmail?: string;
  /**
   * ¿La agencia usa el módulo de validación de identidad? Por defecto true. El
   * admin puede apagarlo si la agencia no lo quiere.
   */
  identityEnabled?: boolean;
  /** Número de WhatsApp de captura de la agencia (informativo/enrutamiento). */
  whatsappNumber?: string;
  /** Campos personalizados que la agencia agrega a su formulario de captura. */
  intakeFields?: IntakeFieldDef[];
  /** Valores por defecto para los contratos de la agencia. */
  defaults?: Partial<AgencyContractDefaults>;
  /** Reglas de estudio del inquilino/codeudor configuradas por la agencia. */
  studyRules?: StudyRule[];
  /**
   * Auto-recarga (plan Ilimitado): cuando el saldo baja del umbral, se genera
   * automáticamente una orden del plan elegido y se avisa a la agencia para
   * pagarla (prepago asistido). `pendingOrderId` evita órdenes duplicadas.
   */
  autoRecharge?: { enabled: boolean; planCode: string; thresholdCredits: number; pendingOrderId?: string | null };
  /** Cómo se dio de alta (manual admin vs auto-registro). Por defecto "admin". */
  origin?: AgencyOrigin;
  /**
   * Prueba gratuita (auto-registro): la agencia arranca con créditos de cortesía.
   * El admin puede revocar la prueba (suspender) desde el panel.
   */
  trial?: { active: boolean; startedAt: string; creditsGranted: number };
  /** Mensaje que se le mostró/envió a la agencia al revocar (auditoría). */
  suspendedMessage?: string;
  suspendedAt?: string;
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
  /** Dueño (arrendador) al que pertenece el inmueble. Al elegir el inmueble, el dueño viene solo. */
  landlordId?: string;
  /** Código propio de la agencia para este inmueble (si maneja los suyos). */
  externalId?: string;
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

/** Defaults efectivos de contrato de la agencia (con fallback a los del sistema). */
export function effectiveAgencyDefaults(agency: Pick<Agency, "defaults">): AgencyContractDefaults {
  const d = agency.defaults ?? {};
  return {
    paymentSupportPolicy: d.paymentSupportPolicy ?? DEFAULT_AGENCY_CONTRACT_DEFAULTS.paymentSupportPolicy,
    utilitiesResponsible: (d.utilitiesResponsible ?? "").trim() || DEFAULT_AGENCY_CONTRACT_DEFAULTS.utilitiesResponsible,
    utilitiesDetails: (d.utilitiesDetails ?? "").trim() || DEFAULT_AGENCY_CONTRACT_DEFAULTS.utilitiesDetails,
    adminFeesDetails: (d.adminFeesDetails ?? "").trim() || DEFAULT_AGENCY_CONTRACT_DEFAULTS.adminFeesDetails,
  };
}

/** ¿La agencia tiene activo el módulo de identidad? (por defecto sí). */
export function isIdentityEnabledForAgency(agency: Pick<Agency, "identityEnabled">): boolean {
  return agency.identityEnabled !== false;
}

/** ¿El correo pertenece a la agencia (miembro)? No incluye admin interno. */
export function isAgencyMemberEmail(agency: Agency, email: string | null | undefined): boolean {
  const target = normalizeAgencyEmail(email);
  if (!target) return false;
  return agency.memberEmails.map(normalizeAgencyEmail).includes(target);
}
