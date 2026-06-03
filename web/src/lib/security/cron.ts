import { NextResponse } from "next/server";

/**
 * Autenticación para endpoints disparados por cron (Vercel Cron, GitHub Actions
 * o un servicio externo). Si `CRON_SECRET` está configurado, exige que la
 * solicitud lo presente en `Authorization: Bearer <secret>` o en el header
 * `x-cron-secret`. Si NO está configurado, se permite solo fuera de producción
 * (para no bloquear pruebas locales) y se bloquea en producción.
 *
 * Compatibilidad: endpoints previos que no exigían secreto siguen funcionando
 * mientras `CRON_SECRET` no esté definido en desarrollo.
 */
export function requireCronAuth(
  request: Request,
): { ok: true } | { ok: false; response: NextResponse } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return { ok: true };
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "config", message: "CRON_SECRET no configurado en el servidor." }] },
        { status: 503 },
      ),
    };
  }
  const auth = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (bearer === secret || headerSecret === secret) return { ok: true };
  return {
    ok: false,
    response: NextResponse.json(
      { success: false, errors: [{ field: "auth", message: "No autorizado." }] },
      { status: 401 },
    ),
  };
}
