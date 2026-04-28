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

export type ContractVersion = "AS-LEASE-MVP-2026.1";

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

