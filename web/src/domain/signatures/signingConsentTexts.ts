import type { ConsentTexts } from "./types";

/** Textos mostrados al firmante (deben coincidir con la UI de /firma/[token]). */
export const SIGNING_CONSENT_TEXTS = {
  contractReadingAcceptance:
    "Declaro que he leído el contrato, entiendo su contenido y acepto firmarlo electrónicamente.",
  electronicSignatureAcceptance: "Acepto el uso de firma electrónica simple para este contrato.",
} as const satisfies ConsentTexts;

/**
 * Declaración adicional del titular de los datos: confirma que los datos
 * registrados sobre él/ella (que pudo haber ingresado otra parte) son correctos.
 * Cierra el consentimiento del titular (Habeas Data, Ley 1581 de 2012) bajo
 * gravedad de juramento, con evidencia de la firma.
 */
export const SIGNING_DATA_CONFIRMATION_TEXT =
  "Confirmo que los datos personales registrados sobre mí en este contrato (nombre, documento, contacto y dirección) son correctos y verdaderos, los acepto bajo la gravedad de juramento y autorizo su tratamiento conforme a la Ley 1581 de 2012.";
