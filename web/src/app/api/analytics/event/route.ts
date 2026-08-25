import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { logEvent } from "@/lib/analytics/events";
import { RATE_LIMIT_RULES, checkRateLimit, clientIpFromRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/** Tope defensivo del cuerpo (eventos de analítica son pequeños). */
const MAX_BODY_BYTES = 8_000;

/**
 * Recibe eventos de producto del cliente (navigator.sendBeacon o fetch keepalive).
 * Best-effort: valida el nombre contra la lista blanca y responde 204 siempre
 * (no filtra si el evento se aceptó o no). Si hay token Bearer, asocia el uid.
 */
export async function POST(request: Request) {
  try {
    // Rate limit por IP: endpoint público que escribe en Firestore (anti-abuso).
    const rate = await checkRateLimit(clientIpFromRequest(request), RATE_LIMIT_RULES.clientError);
    if (!rate.ok) return new NextResponse(null, { status: 204 });

    // sendBeacon manda text/plain; también aceptamos JSON.
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 });
    let body: { name?: string; anonId?: string; props?: unknown } | null = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    const name = body?.name?.toString() ?? "";
    if (!name) return new NextResponse(null, { status: 204 });

    // uid opcional: solo si viene un token válido (no bloquea si no).
    let uid: string | null = null;
    const authz = request.headers.get("authorization") ?? "";
    const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : "";
    if (token) {
      try {
        const auth = getAdminAuth();
        if (auth) uid = (await auth.verifyIdToken(token)).uid;
      } catch { /* anónimo */ }
    }

    await logEvent({
      name,
      uid,
      anonId: body?.anonId?.toString() ?? null,
      props: body?.props,
      ip: requestClientIp(request) ?? null,
      userAgent: requestUserAgent(request) ?? null,
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
