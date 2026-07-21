/**
 * Ruido de navegador/terceros que NO es un bug de la app y no debe registrarse
 * ni disparar alertas (correo/Telegram). Mismo criterio que el `ignoreErrors`
 * de Sentry. Módulo **puro** (sin server-only): lo usa el reporter del cliente
 * y también la ingesta del servidor, como doble filtro.
 *
 * Son universalmente benignos:
 *  - Rechazos de promesa sin razón útil (scripts de anuncios/analytics de Google).
 *  - Aborts/errores de red de Safari.
 *  - `webkit.messageHandlers` → navegador in-app de Facebook/Instagram/iOS.
 *  - Bucles de ResizeObserver.
 */
const BENIGN_PATTERNS: RegExp[] = [
  /Non-Error promise rejection captured/i,
  /^Promesa rechazada$/i,
  /Load failed/i,
  /Failed to fetch/i,
  /NetworkError/i,
  /network connection was lost/i,
  /\bAbortError\b/i,
  /operation was aborted/i,
  /\bcancell?ed\b/i,
  /ResizeObserver loop/i,
  /webkit\.messageHandlers/i,
];

/** ¿El mensaje de error es ruido benigno que debemos ignorar? */
export function isBenignClientError(message: string | null | undefined): boolean {
  const m = (message || "").trim();
  if (!m) return true; // sin mensaje no es accionable
  return BENIGN_PATTERNS.some((re) => re.test(m));
}
