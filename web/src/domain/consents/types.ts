/**
 * Tipos del consentimiento informado para tratamiento de datos personales
 * en ArriendoSeguro (Colombia — Ley 1581 de 2012, Decreto 1377 de 2013).
 *
 * Cada versión del consentimiento es inmutable. Si cambia el texto, se
 * publica una nueva versión y los usuarios deben volver a aceptarla antes
 * de seguir creando contratos.
 */

export type ConsentVersion = "CONSENT-2026.1" | "CONSENT-2026.2";

export type ConsentSurface = "REGISTRATION" | "CONTRACT_WIZARD_START";

export interface ConsentText {
  version: ConsentVersion;
  publishedAt: string;
  shortText: string;
  fullText: string;
}

export interface ConsentRecord {
  uid: string;
  email: string;
  version: ConsentVersion | string;
  surface: ConsentSurface;
  ipAddress: string | null;
  userAgent: string | null;
  consentHash: string;
  acceptedAt: string;
}
