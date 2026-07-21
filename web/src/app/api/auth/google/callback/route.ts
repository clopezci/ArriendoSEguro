import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * Callback del OAuth de Google (lado servidor). Google redirige aquí con `code`.
 * Pasos (todo server-to-server, sin recursos de Google en el navegador):
 *  1) Verifica el `state` (anti-CSRF) contra la cookie.
 *  2) Intercambia el `code` por tokens en oauth2.googleapis.com (con el secreto).
 *  3) Del id_token saca email/nombre; busca o crea el usuario en Firebase Auth.
 *  4) Emite un CUSTOM TOKEN de Firebase y lo deja en cookie httpOnly corta.
 *  5) Redirige a /auth/complete, que en el cliente hace signInWithCustomToken
 *     (solo habla con identitytoolkit, que los bloqueadores no tapian).
 */

function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/nuevo";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/nuevo";
  return raw;
}

/** Decodifica el payload de un JWT (sin verificar firma: el id_token viene
 *  directo del endpoint de tokens de Google por TLS, es de confianza). */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1] ?? "";
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const json = Buffer.from(b64 + pad, "base64").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

function redirectWithError(origin: string, next: string, reason: string): NextResponse {
  const sep = next.includes("?") ? "&" : "?";
  const res = NextResponse.redirect(new URL(`${next}${sep}googleError=${encodeURIComponent(reason)}`, origin));
  res.cookies.set("g_state", "", { path: "/api/auth/google", maxAge: 0 });
  res.cookies.set("g_next", "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const next = safeNext(request.cookies.get("g_next")?.value);

  const err = url.searchParams.get("error");
  if (err) return redirectWithError(origin, next, err);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("g_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectWithError(origin, next, "state_mismatch");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const adminAuth = getAdminAuth();
  if (!clientId || !clientSecret || !adminAuth) {
    return redirectWithError(origin, next, "not_configured");
  }

  try {
    // 2) Intercambio del código por tokens (server-to-server).
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      // Capturamos el error EXACTO de Google para diagnosticar sin adivinar:
      // invalid_client (secreto/ID no coinciden), redirect_uri_mismatch, etc.
      const body = await tokenRes.text().catch(() => "");
      let gerr = "";
      try {
        gerr = String((JSON.parse(body) as { error?: string }).error ?? "");
      } catch {
        /* respuesta no-JSON */
      }
      return redirectWithError(origin, next, `token_exchange_${gerr || tokenRes.status}`);
    }
    const tok = (await tokenRes.json()) as { id_token?: string };
    if (!tok.id_token) return redirectWithError(origin, next, "no_id_token");

    // 3) Datos del usuario desde el id_token.
    const claims = decodeJwtPayload(tok.id_token);
    const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
    const emailVerified = claims.email_verified === true || claims.email_verified === "true";
    const name = typeof claims.name === "string" ? claims.name : undefined;
    const picture = typeof claims.picture === "string" ? claims.picture : undefined;
    if (!email) return redirectWithError(origin, next, "no_email");

    // Busca o crea el usuario de Firebase por email (enlaza con cuentas de
    // correo/contraseña existentes del mismo email).
    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const created = await adminAuth.createUser({
        email,
        emailVerified,
        ...(name ? { displayName: name } : {}),
        ...(picture ? { photoURL: picture } : {}),
      });
      uid = created.uid;
    }

    // 4) Custom token de Firebase → sesión en el cliente sin recursos de Google.
    const customToken = await adminAuth.createCustomToken(uid);

    const res = NextResponse.redirect(
      new URL(`/auth/complete?next=${encodeURIComponent(next)}`, origin),
    );
    res.cookies.set("g_ct", customToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: 120,
    });
    res.cookies.set("g_state", "", { path: "/api/auth/google", maxAge: 0 });
    res.cookies.set("g_next", "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  } catch {
    return redirectWithError(origin, next, "server_error");
  }
}
