/**
 * Inicializa **Google Consent Mode v2** ANTES de cargar GA4 o AdSense.
 *
 * Se renderiza como un `<script>` inline síncrono (sin `src`) colocado en el
 * layout antes de los scripts de GA: se ejecuta en orden de parseo, de modo que
 * el estado por defecto queda fijado antes de que gtag.js procese nada.
 *
 * - Define `dataLayer` y `gtag` de forma temprana.
 * - Fija el estado por defecto en **denegado** para publicidad y analítica
 *   (privacy-first), dejando funcionales solo seguridad y funcionalidad básica.
 * - Si el visitante ya decidió antes (localStorage), aplica su elección de
 *   inmediato para no perder medición tras recargar.
 *
 * El banner (`CookieConsentBanner`) actualiza este estado con
 * `gtag('consent','update', …)`. Ver `src/lib/consent/cookie-consent.ts`.
 */
const CONSENT_MODE_SNIPPET = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('consent','default',{
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  analytics_storage:'denied',
  functionality_storage:'granted',
  security_storage:'granted'
});
try {
  var raw = localStorage.getItem('as_cookie_consent');
  if (raw) {
    var c = JSON.parse(raw);
    if (c && c.v === 1) {
      gtag('consent','update',{
        analytics_storage: c.analytics ? 'granted' : 'denied',
        ad_storage: c.ads ? 'granted' : 'denied',
        ad_user_data: c.ads ? 'granted' : 'denied',
        ad_personalization: c.ads ? 'granted' : 'denied'
      });
    }
  }
} catch (e) {}
`;

export function ConsentMode() {
  return <script id="consent-mode-default" dangerouslySetInnerHTML={{ __html: CONSENT_MODE_SNIPPET }} />;
}
