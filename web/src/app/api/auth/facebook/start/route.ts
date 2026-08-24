import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

/**
 * Login con Facebook del lado del SERVIDOR (OAuth 2.0 Authorization Code), igual
 * que el de Google: el navegador solo NAVEGA a facebook.com; el intercambio de
 * código y la creación de la sesión ocurren en el backend → robusto ante
 * extensiones/bloqueadores.
 *
 * Requiere en el entorno (Vercel):
 *  - FACEBOOK_OAUTH_CLIENT_ID       (App ID de Meta)
 *  - FACEBOOK_OAUTH_CLIENT_SECRET   (App Secret; se usa en /callback)
 * y en Meta for Developers, el "Valid OAuth Redirect URI":
 *   <origen>/api/auth/facebook/callback
 */

function safeNext(raw: string | null): string {
  if (!raw) return "/nuevo";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/nuevo";
  return raw;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.FACEBOOK_OAUTH_CLIENT_ID?.trim();
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  if (!clientId) {
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}facebookError=not_configured`, url.origin));
  }

  const redirectUri = `${url.origin}/api/auth/facebook/callback`;
  const state = randomBytes(16).toString("hex");

  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "email,public_profile");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/api/auth/facebook",
    maxAge: 600,
  };
  res.cookies.set("f_state", state, cookieOpts);
  res.cookies.set("f_next", next, cookieOpts);
  return res;
}
