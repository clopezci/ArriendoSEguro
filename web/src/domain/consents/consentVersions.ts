import { generateDocumentHash } from "../contracts/hash";
import type { ConsentText, ConsentVersion } from "./types";

/**
 * Versión vigente del consentimiento. Cuando se publique una nueva (por
 * ejemplo `CONSENT-2026.2`), los usuarios deberán aceptarla antes de
 * volver a crear un contrato; el consentimiento previo se conserva como
 * histórico inmutable en `user_consents`.
 */
export const CONSENT_CURRENT_VERSION: ConsentVersion = "CONSENT-2026.2";

export const CONSENT_REGISTRY: Record<ConsentVersion, ConsentText> = {
  "CONSENT-2026.1": {
    version: "CONSENT-2026.1",
    publishedAt: "2026-05-11",
    shortText:
      "He leído y acepto el Aviso de privacidad y autorizo el tratamiento de mis datos personales por parte de Arriendo Seguro, conforme a la Ley 1581 de 2012.",
    fullText: `Acepto que Arriendo Seguro trate mis datos personales con las siguientes finalidades:

1. Crear y administrar mi cuenta en la plataforma.
2. Gestionar el o los expedientes de arriendo en los que participe, incluyendo datos de las partes, inmueble, términos, servicios públicos, codeudor solidario cuando aplique, pagos informativos, firma electrónica y comunicaciones.
3. Emitir y conservar documentos asociados al contrato y a sus anexos: inventario, acta de entrega, registro de pagos, evidencia de firma electrónica y comunicaciones de mora cuando corresponda.
4. Conservar evidencia digital (dirección IP, fecha y hora, agente de usuario y hash documental) que permita verificar la autoría e integridad de mis firmas, conforme a la Ley 527 de 1999.
5. Prestar soporte, atender solicitudes y dar cumplimiento a obligaciones legales aplicables.

Conozco el Aviso de privacidad disponible en la plataforma y mis derechos de conocer, actualizar, rectificar y suprimir mis datos personales, así como de revocar el consentimiento otorgado, conforme a la Ley 1581 de 2012 y al Decreto 1377 de 2013. Sé que puedo presentar consulta o reclamo ante la Superintendencia de Industria y Comercio cuando corresponda.`,
  },
  // 2026-08-11: se unifica la marca a "ArriendoSeguro" (una palabra). Cambio de
  // texto → nueva versión; los usuarios la re-aceptan antes de crear contrato.
  "CONSENT-2026.2": {
    version: "CONSENT-2026.2",
    publishedAt: "2026-08-11",
    shortText:
      "He leído y acepto el Aviso de privacidad y autorizo el tratamiento de mis datos personales por parte de ArriendoSeguro, conforme a la Ley 1581 de 2012.",
    fullText: `Acepto que ArriendoSeguro trate mis datos personales con las siguientes finalidades:

1. Crear y administrar mi cuenta en la plataforma.
2. Gestionar el o los expedientes de arriendo en los que participe, incluyendo datos de las partes, inmueble, términos, servicios públicos, codeudor solidario cuando aplique, pagos informativos, firma electrónica y comunicaciones.
3. Emitir y conservar documentos asociados al contrato y a sus anexos: inventario, acta de entrega, registro de pagos, evidencia de firma electrónica y comunicaciones de mora cuando corresponda.
4. Conservar evidencia digital (dirección IP, fecha y hora, agente de usuario y hash documental) que permita verificar la autoría e integridad de mis firmas, conforme a la Ley 527 de 1999.
5. Prestar soporte, atender solicitudes y dar cumplimiento a obligaciones legales aplicables.

Conozco el Aviso de privacidad disponible en la plataforma y mis derechos de conocer, actualizar, rectificar y suprimir mis datos personales, así como de revocar el consentimiento otorgado, conforme a la Ley 1581 de 2012 y al Decreto 1377 de 2013. Sé que puedo presentar consulta o reclamo ante la Superintendencia de Industria y Comercio cuando corresponda.`,
  },
};

export function getCurrentConsentText(): ConsentText {
  return CONSENT_REGISTRY[CONSENT_CURRENT_VERSION];
}

export function getConsentText(version: ConsentVersion | string): ConsentText | null {
  const v = version as ConsentVersion;
  return CONSENT_REGISTRY[v] ?? null;
}

/**
 * Hash determinista del texto del consentimiento aceptado. Sirve para que,
 * si el texto cambiara accidentalmente, podamos detectarlo y exigir nueva
 * aceptación.
 */
export function computeConsentHash(version: ConsentVersion | string): string | null {
  const t = getConsentText(version);
  if (!t) return null;
  return generateDocumentHash(`${t.version}|${t.fullText}`);
}
