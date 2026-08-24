import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Entrega (una sola vez) el custom token que dejó el callback en la cookie
 * httpOnly `f_ct`, y la BORRA. El cliente (/auth/complete) lo usa de inmediato
 * con signInWithCustomToken. El token no viaja nunca por la URL.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("f_ct")?.value;
  const res = NextResponse.json(token ? { success: true, token } : { success: false });
  res.cookies.set("f_ct", "", { path: "/api/auth/facebook", maxAge: 0 });
  return res;
}
