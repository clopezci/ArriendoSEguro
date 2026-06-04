/**
 * Abstracción de "proveedor de firma".
 *
 * Hoy la firma es **electrónica simple** (token + OTP por correo + evidencia,
 * Ley 527 de 1999), implementada por el flujo interno (rutas `api/signatures/*`).
 * Esta interfaz deja el punto de integración listo para enchufar un proveedor
 * externo (p. ej. **Firma.dev**) sin reescribir el flujo: se implementa un
 * adaptador nuevo y la factory lo selecciona por variable de entorno.
 *
 * Módulo de tipos puro (sin red).
 */

export type SignatureProviderId = "internal" | "firma_dev";

export interface SignatureSignerInput {
  party: string; // "landlord" | "tenant" | "solidaryCoDebtor"
  fullName: string;
  email: string;
  documentNumber: string;
}

export interface SignatureRequestInput {
  contractId: string;
  contractVersionId: string;
  documentHash: string;
  /** URL o referencia del PDF a firmar (cuando el proveedor lo requiere). */
  documentUrl?: string;
  signers: SignatureSignerInput[];
  /** URL a la que el proveedor notifica el avance (webhook), si aplica. */
  callbackUrl?: string;
}

export interface SignatureRequestResult {
  providerRef: string;
  signers: { party: string; signingUrl?: string }[];
  /** Respuesta cruda del proveedor (para depurar/auditar). */
  raw?: unknown;
}

export type SignatureProviderStatusCode =
  | "pending"
  | "in_progress"
  | "completed"
  | "declined"
  | "expired"
  | "error";

export interface SignatureProviderStatus {
  providerRef: string;
  status: SignatureProviderStatusCode;
  signers: { party: string; signed: boolean; signedAt?: string }[];
  completedDocumentUrl?: string;
}

export interface SignatureProvider {
  readonly id: SignatureProviderId;
  /** true si delega en un servicio externo (Firma.dev); false si es el flujo interno. */
  readonly isExternal: boolean;
  /** true si el proveedor tiene las credenciales/condiciones para operar. */
  isConfigured(): boolean;
  createSignatureRequest(input: SignatureRequestInput): Promise<SignatureRequestResult>;
  getStatus(providerRef: string): Promise<SignatureProviderStatus>;
}

export class SignatureProviderNotConfiguredError extends Error {
  constructor(providerId: SignatureProviderId) {
    super(`El proveedor de firma "${providerId}" no está configurado (faltan credenciales).`);
    this.name = "SignatureProviderNotConfiguredError";
  }
}
