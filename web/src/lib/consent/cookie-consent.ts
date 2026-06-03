/**
 * Estado de consentimiento de cookies (cliente).
 *
 * Categorías:
 *  - `necessary`: siempre activas (sesión, seguridad, anti-bot). No se piden.
 *  - `analytics`: Google Analytics 4 (medición de uso).
 *  - `ads`: cookies de publicidad (Google AdSense, cuando se active).
 *
 * Se integra con **Google Consent Mode v2**: el banner llama a
 * `gtag('consent','update', …)` para conceder o denegar `analytics_storage`,
 * `ad_storage`, `ad_user_data` y `ad_personalization`. El estado por defecto
 * (denegado) lo fija `ConsentMode` antes de cargar cualquier script.
 */

export const CONSENT_STORAGE_KEY = "as_cookie_consent";
export const CONSENT_VERSION = 1;

/** Evento para reabrir el panel de preferencias desde el footer. */
export const OPEN_PREFERENCES_EVENT = "as:open-cookie-preferences";

export type CookieConsent = {
  /** Versión del esquema de consentimiento (para invalidar si cambian categorías). */
  v: number;
  analytics: boolean;
  ads: boolean;
  /** Marca de tiempo (epoch ms) de la decisión. */
  ts: number;
};

export function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (parsed && parsed.v === CONSENT_VERSION) {
      return {
        v: CONSENT_VERSION,
        analytics: Boolean(parsed.analytics),
        ads: Boolean(parsed.ads),
        ts: typeof parsed.ts === "number" ? parsed.ts : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

type GtagFn = (...args: unknown[]) => void;

function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return typeof w.gtag === "function" ? w.gtag : null;
}

/** Aplica el consentimiento a Consent Mode (no-op si gtag no está cargado). */
export function applyConsentToGtag(consent: { analytics: boolean; ads: boolean }): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("consent", "update", {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.ads ? "granted" : "denied",
    ad_user_data: consent.ads ? "granted" : "denied",
    ad_personalization: consent.ads ? "granted" : "denied",
  });
}

/** Persiste la decisión y la propaga a Consent Mode. */
export function saveConsent(consent: { analytics: boolean; ads: boolean }): CookieConsent {
  const value: CookieConsent = {
    v: CONSENT_VERSION,
    analytics: consent.analytics,
    ads: consent.ads,
    ts: Date.now(),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* almacenamiento no disponible: el banner volverá a mostrarse */
    }
  }
  applyConsentToGtag(consent);
  return value;
}
