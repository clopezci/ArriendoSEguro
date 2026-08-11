/**
 * Versionado del aviso de privacidad (Bloque 13).
 * La UI pública usa `PRIVACY_POLICY_CURRENT`; si cambia el texto sustancial,
 * publicar nueva versión y documentar reaceptación en el flujo de cuenta/consentimientos.
 */
export type PrivacyPolicyVersionId = "AVISO-PRIV-2026.2";

export const PRIVACY_POLICY_CURRENT: PrivacyPolicyVersionId = "AVISO-PRIV-2026.2";

export type PrivacyPolicyMeta = {
  id: PrivacyPolicyVersionId;
  /** Fecha de publicación en formato ISO (solo fecha). */
  publishedAt: string;
  /** Responsable del tratamiento (nombre comercial; datos societarios los define el negocio). */
  controllerLabel: string;
};

export const PRIVACY_POLICY_REGISTRY: Record<PrivacyPolicyVersionId, PrivacyPolicyMeta> = {
  "AVISO-PRIV-2026.2": {
    id: "AVISO-PRIV-2026.2",
    // Revisado 2026-08-11: se identifica a LOTIC como responsable/operador de la
    // plataforma ArriendoSeguro. Cambio aclaratorio de identificación del
    // responsable, no exige reaceptación.
    publishedAt: "2026-08-11",
    controllerLabel: "LOTIC",
  },
};

export function getCurrentPrivacyPolicyMeta(): PrivacyPolicyMeta {
  return PRIVACY_POLICY_REGISTRY[PRIVACY_POLICY_CURRENT];
}
