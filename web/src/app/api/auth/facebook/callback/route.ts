import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * Callback del OAuth de Facebook (lado servidor). Meta redirige aquí con `code`.
 *  1) Verifica el `state` (anti-CSRF) contra la cookie.
 *  2) Intercambia el `code` por un access_token (graph.facebook.com, con el secreto).
 *  3) Pide /me (id, nombre, email, foto) con el access_token.
 *  4) Busca o crea el usuario en Firebase Auth por email (enlaza con cuentas del
 *     mismo correo) y emite un CUSTOM TOKEN de Firebase en cookie httpOnly corta.
 *  5) Redirige a /auth/complete?provider=facebook, que hace signInWithCustomToken.
 */

const GRAPH = "https://graph.facebook.com/v19.0";

function safeNext(raw: string | null | undefined): string {
  if (!raw) return "/nuevo";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/nuevo";
  return raw;
}

function redirectWithError(origin: string, next: string, reason: string): NextResponse {
  const sep = next.includes("?") ? "&" : "?";
  const res = NextResponse.redirect(new URL(`${next}${sep}facebookError=${encodeURIComponent(reason)}`, origin));
  res.cookies.set("f_state", "", { path: "/api/auth/facebook", maxAge: 0 });
  res.cookies.set("f_next", "", { path: "/api/auth/facebook", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const next = safeNext(request.cookies.get("f_next")?.value);

  const err = url.searchParams.get("error");
  if (err) return redirectWithError(origin, next, err);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("f_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectWithError(origin, next, "state_mismatch");
  }

  const clientId = process.env.FACEBOOK_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.FACEBOOK_OAUTH_CLIENT_SECRET?.trim();
  const adminAuth = getAdminAuth();
  if (!clientId || !clientSecret || !adminAuth) {
    return redirectWithError(origin, next, "not_configured");
  }

  try {
    // 2) Intercambio del código por access_token (server-to-server, GET).
    const tokenUrl = new URL(`${GRAPH}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("redirect_uri", `${origin}/api/auth/facebook/callback`);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetch(tokenUrl.toString(), { cache: "no-store" });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      let ferr = "";
      try { ferr = String((JSON.parse(body) as { error?: { message?: string } }).error?.message ?? ""); } catch { /* no-JSON */ }
      return redirectWithError(origin, next, `token_exchange_${ferr ? ferr.slice(0, 40) : tokenRes.status}`);
    }
    const tok = (await tokenRes.json()) as { access_token?: string };
    if (!tok.access_token) return redirectWithError(origin, next, "no_access_token");

    // 3) Datos del usuario desde el Graph API.
    const meUrl = new URL(`${GRAPH}/me`);
    meUrl.searchParams.set("fields", "id,name,email,picture.type(large)");
    meUrl.searchParams.set("access_token", tok.access_token);
    const meRes = await fetch(meUrl.toString(), { cache: "no-store" });
    if (!meRes.ok) return redirectWithError(origin, next, "profile_error");
    const me = (await meRes.json()) as { id?: string; name?: string; email?: string; picture?: { data?: { url?: string } } };

    const email = typeof me.email === "string" ? me.email.toLowerCase() : "";
    const name = typeof me.name === "string" ? me.name : undefined;
    const picture = me.picture?.data?.url;
    // Facebook puede no entregar email (cuenta sin correo o permiso no otorgado).
    if (!email) return redirectWithError(origin, next, "no_email");

    // Busca o crea el usuario de Firebase por email (enlaza con correo/contraseña
    // existente del mismo email).
    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(email);
      uid = existing.uid;
    } catch {
      const created = await adminAuth.createUser({
        email,
        emailVerified: true, // Meta ya verificó el correo del usuario.
        ...(name ? { displayName: name } : {}),
        ...(picture ? { photoURL: picture } : {}),
      });
      uid = created.uid;
    }

    const customToken = await adminAuth.createCustomToken(uid);
    const res = NextResponse.redirect(
      new URL(`/auth/complete?provider=facebook&next=${encodeURIComponent(next)}`, origin),
    );
    res.cookies.set("f_ct", customToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/auth/facebook",
      maxAge: 120,
    });
    res.cookies.set("f_state", "", { path: "/api/auth/facebook", maxAge: 0 });
    res.cookies.set("f_next", "", { path: "/api/auth/facebook", maxAge: 0 });
    return res;
  } catch {
    return redirectWithError(origin, next, "server_error");
  }
}
