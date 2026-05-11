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
  truthfulnessOath: "Declaración bajo gravedad de juramento",
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
  truthfulnessOath: boolean;
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
    truthfulnessOath: formData.get("truthfulnessOath") === "on",
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

/**
 * Lee los datos opcionales de respaldo económico del codeudor desde el
 * `FormData`. Devuelve `undefined` si el arrendador no marcó ninguna
 * opción (no inflar el draft con objetos vacíos).
 */
export function sanitizeCodebtorEconomicSupportFromForm(
  formData: FormData,
): import("./draft-types").CodebtorEconomicSupportDraft | undefined {
  const employerName = toTitleCaseEs(String(formData.get("supportEmployerName") ?? ""));
  const position = toTitleCaseEs(String(formData.get("supportPosition") ?? ""));
  const monthlyIncomeRaw = String(formData.get("supportMonthlyIncome") ?? "").trim();
  const monthlyIncome = monthlyIncomeRaw ? Number(monthlyIncomeRaw) : undefined;
  const notes = sanitizeFreeText(String(formData.get("supportNotes") ?? ""));
  const landlordVerifiedConsent = formData.get("supportLandlordVerified") === "on";
  const docKeys = [
    "CARTA_LABORAL",
    "COLILLA_PAGO",
    "CERTIFICADO_LIBERTAD_TRADICION",
    "EXTRACTO_BANCARIO",
    "DECLARACION_RENTA",
    "OTRO",
  ] as const;
  const documentsProvided = docKeys.filter(
    (key) => formData.get(`supportDoc_${key}`) === "on",
  );

  const isEmpty =
    !employerName &&
    !position &&
    !monthlyIncome &&
    !notes &&
    !landlordVerifiedConsent &&
    documentsProvided.length === 0;
  if (isEmpty) return undefined;

  return {
    employerName: employerName || undefined,
    position: position || undefined,
    monthlyIncome:
      typeof monthlyIncome === "number" && Number.isFinite(monthlyIncome) && monthlyIncome > 0
        ? monthlyIncome
        : undefined,
    documentsProvided: documentsProvided.length > 0 ? documentsProvided : undefined,
    notes: notes || undefined,
    landlordVerifiedConsent: landlordVerifiedConsent || undefined,
  };
}
