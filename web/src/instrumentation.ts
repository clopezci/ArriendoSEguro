import * as Sentry from "@sentry/nextjs";
import { SENTRY_COMMON } from "@/lib/sentry";

/**
 * Inicialización de Sentry en el SERVIDOR (Node y Edge). Next llama a `register`
 * al arrancar. Solo errores (sin performance), activo en producción.
 */
export async function register() {
  Sentry.init({ ...SENTRY_COMMON });
}

// Captura errores de las rutas/handlers del servidor (App Router, Next 15).
export const onRequestError = Sentry.captureRequestError;
