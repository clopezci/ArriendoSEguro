import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Entrega (una sola vez) el custom token que dejó el callback en la cookie
 * httpOnly `g_ct`, y la BORRA. El cliente (/auth/complete) lo usa de inmediato
 * con signInWithCustomToken. El token no viaja nunca por la URL.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("g_ct")?.value;
  const res = NextResponse.json(token ? { success: true, token } : { success: false });
  res.cookies.set("g_ct", "", { path: "/api/auth/google", maxAge: 0 });
  return res;
}
