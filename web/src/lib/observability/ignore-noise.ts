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
 *  - `insertBefore`/`removeChild` "not a child" → extensiones de traducción
 *    (Google Translate) que mutan el DOM que controla React; no es bug de la app.
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
  /not a child of this node/i,
  /insertBefore.*Node/i,
  /removeChild.*Node/i,
  /The node (before|to be removed) /i,
  // Extensiones de billetera cripto (MetaMask, etc.) que se inyectan en la página.
  /MetaMask/i,
  /ethereum/i,
  /web3/i,
  /Cannot redefine property: ethereum/i,
  // Ruido de terceros/extensiones observado en producción (inactivo desde jun–jul
  // 2026, sin correlación con flujos de la app):
  //  - `e[o] is not a function`: rechazo desde script minificado de terceros.
  //  - `object is not extensible`: una librería/extensión intenta escribir en un
  //    objeto congelado (p. ej. añadir `.code` a un Error inmutable).
  /\be\[o\] is not a function\b/i,
  /object is not extensible/i,
];

/** ¿El mensaje de error es ruido benigno que debemos ignorar? */
export function isBenignClientError(message: string | null | undefined): boolean {
  const m = (message || "").trim();
  if (!m) return true; // sin mensaje no es accionable
  return BENIGN_PATTERNS.some((re) => re.test(m));
}
