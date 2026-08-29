import { NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { recordPageview } from "@/lib/observability/pageviews";

export const runtime = "nodejs";

/**
 * Beacon de VISITA (sin cookies, sin sesión). El navegador lo envía en cada
 * cambio de ruta. No guarda datos personales (ver `pageviews.ts`). Responde 204
 * siempre y rápido; nunca bloquea la navegación.
 */
export async function POST(request: Request) {
  const firestore = getAdminFirestore();
  if (!firestore) return new NextResponse(null, { status: 204 });

  let path = "/";
  try {
    const body = (await request.json()) as { path?: unknown };
    if (typeof body?.path === "string") path = body.path;
  } catch {
    /* sendBeacon podría no mandar JSON; se usa "/" por defecto */
  }

  try {
    await recordPageview(firestore, {
      path,
      ip: requestClientIp(request),
      ua: requestUserAgent(request),
      nowMs: Date.now(),
    });
  } catch {
    /* best-effort: una visita no contada no debe romper nada */
  }
  return new NextResponse(null, { status: 204 });
}
