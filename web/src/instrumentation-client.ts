import * as Sentry from "@sentry/nextjs";
import { SENTRY_COMMON } from "@/lib/sentry";

/**
 * Inicialización de Sentry en el NAVEGADOR (cliente). Next carga este archivo
 * automáticamente. Solo errores; sin session replay para no gastar cuota.
 */
Sentry.init({
  ...SENTRY_COMMON,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

// Instrumentación de navegación del App Router (requerido por Next 15.3+).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
