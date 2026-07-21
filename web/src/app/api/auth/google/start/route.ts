import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

/**
 * Login con Google del lado del SERVIDOR (OAuth 2.0 Authorization Code).
 * El navegador solo hace una NAVEGACIÓN de nivel superior a accounts.google.com
 * (que ninguna extensión de bloqueo tapia). El intercambio de código y la
 * creación de la sesión ocurren en el backend → funciona con cualquier navegador.
 *
 * Este endpoint arma la URL de consentimiento de Google y redirige allí, dejando
 * un `state` (anti-CSRF) y el `next` (a dónde volver) en cookies httpOnly.
 *
 * Requiere en el entorno (Vercel):
 *  - GOOGLE_OAUTH_CLIENT_ID
 *  - GOOGLE_OAUTH_CLIENT_SECRET   (se usa en /callback)
 * y en Google Cloud, el redirect URI:  <origen>/api/auth/google/callback
 */

/** Solo permitimos volver a rutas internas (evita open-redirect). */
function safeNext(raw: string | null): string {
  if (!raw) return "/nuevo";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/nuevo";
  return raw;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  if (!clientId) {
    // No configurado: volvemos al origen con un aviso para no romper el flujo.
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}googleError=not_configured`, url.origin));
  }

  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const state = randomBytes(16).toString("hex");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("access_type", "online");

  const res = NextResponse.redirect(authUrl.toString());
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/api/auth/google",
    maxAge: 600,
  };
  res.cookies.set("g_state", state, cookieOpts);
  res.cookies.set("g_next", next, cookieOpts);
  return res;
}
