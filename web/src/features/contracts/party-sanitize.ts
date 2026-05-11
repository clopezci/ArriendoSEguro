/**
 * Sanitización compartida para los formularios de personas
 * (arrendador, arrendatario, codeudor) del asistente de contrato.
 *
 * Centraliza la limpieza para que el contrato y los expedientes guarden
 * datos consistentes (no importa cómo el usuario escriba "BOGOTÁ" o
 * " bogota d.c "): mismo nombre propio queda en mismo formato.
 *
 * No valida: la validación final corre en `landlordSchema`, `tenantSchema`
 * o `codebtorSchema` (definidos en `party-schemas.ts`). Aquí solo se
 * normaliza la entrada cruda de `FormData`.
 */

import { sanitizeFreeText, toTitleCaseEs, toUpperTrimmed, trimAndCollapse } from "@/lib/text/sanitize";

export const PARTY_FIELD_LABELS: Record<string, string> = {
  fullName: "Nombre completo",
  documentType: "Tipo de documento",
  documentNumber: "Número de documento",
  city: "Ciudad",
  email: "Correo electrónico",
  phone: "Teléfono",
  notificationAddress: "Dirección de notificación",
  dataProcessingConsent: "Autorización de tratamiento de datos",
  electronicSignatureConsent: "Consentimiento de firma electrónica",
  solidaryObligationAcceptance: "Aceptación de obligación solidaria",
};

interface BaseSanitizedParty {
  fullName: string;
  documentType: string;
  documentNumber: string;
  city: string;
  email: string;
  phone: string;
  notificationAddress: string;
}

/**
 * Lee y sanitiza los campos comunes de una persona desde un `FormData`.
 * `notificationAddress` se recibe ya formateado por
 * `formatColombianNotificationAddress` desde la página llamadora.
 */
export function sanitizePartyFromForm(
  formData: FormData,
  extras: { notificationAddress: string },
): BaseSanitizedParty {
  return {
    fullName: toTitleCaseEs(String(formData.get("fullName") ?? "")),
    documentType: trimAndCollapse(String(formData.get("documentType") ?? "")).toUpperCase(),
    documentNumber: toUpperTrimmed(String(formData.get("documentNumber") ?? "")),
    city: toTitleCaseEs(String(formData.get("city") ?? "")),
    email: trimAndCollapse(String(formData.get("email") ?? "")).toLowerCase(),
    phone: sanitizeFreeText(String(formData.get("phone") ?? "")),
    notificationAddress: extras.notificationAddress,
  };
}

/**
 * Igual que `sanitizePartyFromForm`, pero agrega los consentimientos
 * extra que requiere el codeudor solidario.
 */
export function sanitizeCodebtorFromForm(
  formData: FormData,
  extras: { notificationAddress: string },
): BaseSanitizedParty & {
  dataProcessingConsent: boolean;
  electronicSignatureConsent: boolean;
  solidaryObligationAcceptance: boolean;
} {
  return {
    ...sanitizePartyFromForm(formData, extras),
    dataProcessingConsent: formData.get("dataProcessingConsent") === "on",
    electronicSignatureConsent: formData.get("electronicSignatureConsent") === "on",
    solidaryObligationAcceptance:
      formData.get("solidaryObligationAcceptance") === "on",
  };
}
