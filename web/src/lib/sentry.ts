/**
 * DSN de Sentry. Un DSN es PÚBLICO por diseño (va en el cliente): solo permite
 * ENVIAR eventos, no leerlos, así que es seguro tenerlo en el repo. Se puede
 * sobreescribir con `NEXT_PUBLIC_SENTRY_DSN` (recomendado ponerlo en Vercel).
 *
 * Config mínima y económica: SOLO errores (sin performance ni session replay)
 * para no consumir la cuota del plan gratuito, y sin datos personales.
 */
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
  "https://8a42d0bae607e39d6b774d41734197e5@o4511745905786880.ingest.us.sentry.io/4511745925054464";

/**
 * Ruido de navegador/red que NO es un bug de la app y satura el buzón (muy común
 * en Safari iOS: aborts de red, extensiones, rechazos de promesa sin mensaje).
 * Filtrarlo NO oculta errores reales: estos patrones son universalmente benignos.
 */
const SENTRY_IGNORE_ERRORS: (string | RegExp)[] = [
  "Load failed", // Safari: fetch abortado/red caída
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
  "The network connection was lost",
  "cancelled",
  "AbortError",
  /Non-Error promise rejection captured/i,
  "ResizeObserver loop", // benigno del navegador
];

/** Opciones compartidas por cliente y servidor. */
export const SENTRY_COMMON = {
  dsn: SENTRY_DSN,
  tracesSampleRate: 0, // solo errores (sin performance)
  sendDefaultPii: false, // no enviar datos personales
  ignoreErrors: SENTRY_IGNORE_ERRORS,
  // Solo activo en producción, para no mandar ruido desde local/desarrollo.
  enabled: process.env.NODE_ENV === "production",
} as const;
