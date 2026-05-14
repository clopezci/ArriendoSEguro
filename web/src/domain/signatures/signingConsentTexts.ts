import type { ConsentTexts } from "./types";

/** Textos mostrados al firmante (deben coincidir con la UI de /firma/[token]). */
export const SIGNING_CONSENT_TEXTS = {
  contractReadingAcceptance:
    "Declaro que he leído el contrato, entiendo su contenido y acepto firmarlo electrónicamente.",
  electronicSignatureAcceptance: "Acepto el uso de firma electrónica simple para este contrato.",
} as const satisfies ConsentTexts;
