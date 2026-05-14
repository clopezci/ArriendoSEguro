export type DocumentType =
  | "CC"
  | "CE"
  | "PASAPORTE"
  | "NIT"
  | "OTRO";

export type SourceLegalFramework =
  | "VIVIENDA_URBANA_CO"
  | "TRATAMIENTO_DATOS_CO"
  | "FIRMA_ELECTRONICA_CO";

/**
 * Versiones registradas de la plantilla del contrato.
 * - `AS-LEASE-MVP-2026.1`: plantilla en producción para todos los expedientes vivos
 *   en la fase inicial (vivienda urbana, Ley 820 de 2003).
 * - `AS-LEASE-2026.2`: nueva versión en borrador (no activa todavía). Agrega
 *   cláusula de liquidación, refuerzos a codeudor, firma electrónica reforzada
 *   con OTP, autenticación notarial opcional y cláusulas especiales solicitadas
 *   por las partes. Su activación queda condicionada a la confirmación del
 *   abogado y a la entrega de los bloques 2 a 10 del plan de mejoras
 *   (`web/docs/plan-mejoras-contrato-flujo.md`).
 */
export type ContractVersion = "AS-LEASE-MVP-2026.1" | "AS-LEASE-2026.2";

/**
 * Tipo de contrato cubierto. En la fase actual solo `VIVIENDA_URBANA` está
 * habilitada; los demás se reservan como placeholders para mostrarse en el
 * flujo con etiqueta de "próximamente disponible".
 */
export type ContractType =
  | "VIVIENDA_URBANA"
  | "VIVIENDA_RURAL"
  | "HABITACION"
  | "COMERCIAL"
  | "RURAL_PRODUCTIVO";

/**
 * Cláusulas especiales seleccionadas por las partes. Su contenido se imprime
 * únicamente en la plantilla `AS-LEASE-2026.2` (cláusula condicional).
 * `costNotified` indica que se le mostró al usuario el aviso de costo adicional
 * antes de generar el contrato.
 */
export interface SpecialClausesSelection {
  enabled: boolean;
  selected: string[];
  freeText?: string;
  costNotified: boolean;
}

/**
 * Resultado del paso opcional de autenticación notarial. El archivo cargado
 * queda referenciado por una ruta interna del expediente (no se incrusta en
 * el HTML del contrato).
 */
export interface NotarizationSelection {
  wantsNotarization: boolean;
  uploadedDocumentRef?: string;
  uploadedAt?: string;
}

/**
 * Registro de orientación sobre historial crediticio (Bloque 6). El
 * arrendador (dueño) indica si verificó o no fuera de la app; no hay
 * carga de documentos. Campos opcionales en borradores anteriores.
 */
export interface CreditCheckSelection {
  /** Legado: interés en estudio vía aliado; hoy suele ser false. */
  wantsCreditCheck?: boolean;
  scope?: Array<"TENANT" | "CODEBTOR">;
  partnerSlug?: string;
  /** Declaración Sí/No del arrendador sobre el inquilino. */
  landlordVerifiedTenantCreditHistory?: "yes" | "no";
  /** Declaración Sí/No del arrendador sobre el codeudor (si aplica). */
  landlordVerifiedCodebtorCreditHistory?: "yes" | "no";
}

export interface PersonParty {
  fullName: string;
  documentType: DocumentType | string;
  documentNumber: string;
  city: string;
  email: string;
  phone: string;
  notificationAddress: string;
}

export interface PropertyData {
  address: string;
  city: string;
  department: string;
  type: string;
  registryNumber: string;
  commercialValue: number;
  legalRentCap: number;
  /**
   * El arrendador declaró NO conocer el valor comercial del inmueble al
   * generar el contrato. Cuando es `true`, ArriendoSeguro no puede calcular
   * el tope del 1% (Ley 820 de 2003) y se omite esa validación. Requiere
   * además aceptación expresa en `noCapAcknowledgement`.
   *
   * Opcional para mantener compatibilidad con expedientes generados antes
   * de habilitar esta opción.
   */
  commercialValueUnknown?: boolean;
  /**
   * Aceptación expresa del arrendador asumiendo la responsabilidad de no
   * superar el 1% del valor comercial real, eximiendo a ArriendoSeguro.
   * Solo es relevante cuando `commercialValueUnknown` es `true`.
   */
  noCapAcknowledgement?: boolean;
  /**
   * Declaración bajo juramento del arrendador sobre el inmueble. Cubre
   * dos puntos críticos para evitar problemas legales:
   * - `truthfulInfoOath`: los datos del inmueble (matrícula, dirección,
   *   tipo) son reales y verdaderos.
   * - `ownerOrAuthorized`: el arrendador es propietario o cuenta con
   *   poder vigente para arrendarlo.
   *
   * Estos campos son opcionales en el tipo para mantener compatibilidad
   * con expedientes previos al ajuste; en el wizard la casilla es
   * obligatoria antes de avanzar.
   */
  ownershipDeclaration?: {
    truthfulInfoOath: boolean;
    ownerOrAuthorized: boolean;
    acceptedAt?: string;
  };
}

export interface LeaseTerms {
  monthlyRent: number;
  monthlyRentText: string;
  paymentDueDay: number;
  paymentMethod: string;
  startDate: string;
  endDate: string;
  termMonths: number;
  latePaymentMonthsThreshold: number;
}

export interface UtilitiesData {
  responsibleParty: string;
  details: string;
  adminFeesDetails: string;
}

export interface ContractControl {
  hasSolidaryCoDebtor: boolean;
  contractVersion: ContractVersion | string;
  generatedAt: string;
}

export interface ResidentialLeaseContractInput {
  landlord: PersonParty;
  tenant: PersonParty;
  solidaryCoDebtor?: PersonParty;
  property: PropertyData;
  lease: LeaseTerms;
  utilities: UtilitiesData;
  hasSolidaryCoDebtor: boolean;
  contractVersion: ContractVersion | string;
  generatedAt: string;
  /**
   * Campo opcional para proteger la fase inicial del producto:
   * en vivienda urbana no se debe pactar depósito en dinero.
   */
  securityDepositAmount?: number;
  /**
   * Los siguientes campos son opcionales y solo se utilizan a partir de la
   * versión `AS-LEASE-2026.2`. Mantenerlos opcionales evita romper expedientes
   * ya generados con `AS-LEASE-MVP-2026.1`.
   */
  contractType?: ContractType;
  specialClauses?: SpecialClausesSelection;
  notarization?: NotarizationSelection;
  creditCheck?: CreditCheckSelection;
  /**
   * Anotaciones especiales del expediente (texto libre acordado por las
   * partes). Se imprimen al final del contrato como sección
   * "Observaciones y acuerdos complementarios" con disclaimer legal
   * explícito: reflejan la voluntad de las partes y no sustituyen las
   * cláusulas anteriores ni la normatividad imperativa aplicable.
   */
  expedienteNotes?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface RenderedContract {
  html: string;
  version: string;
  generatedAt: string;
  documentHash: string;
  legalFramework: SourceLegalFramework[];
}

