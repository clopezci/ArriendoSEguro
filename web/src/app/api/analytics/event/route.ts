import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { requestClientIp, requestUserAgent } from "@/lib/auth/serverAuth";
import { logEvent } from "@/lib/analytics/events";

export const runtime = "nodejs";

/**
 * Recibe eventos de producto del cliente (navigator.sendBeacon o fetch keepalive).
 * Best-effort: valida el nombre contra la lista blanca y responde 204 siempre
 * (no filtra si el evento se aceptó o no). Si hay token Bearer, asocia el uid.
 */
export async function POST(request: Request) {
  try {
    // sendBeacon manda text/plain; también aceptamos JSON.
    const raw = await request.text();
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
