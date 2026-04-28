import type { DecodedIdToken } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/serverAuth";

/**
 * Lista blanca server-side. Nunca uses NEXT_PUBLIC_* para autorizar en API.
 * Ejemplo: ADMIN_INTERNAL_EMAILS=clopezci@hotmail.com
 */
export function getAdminInternalEmailSet(): Set<string> {
  const raw = process.env.ADMIN_INTERNAL_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isInternalAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminInternalEmailSet().has(email.trim().toLowerCase());
}

export async function requireInternalAdmin(request: Request): Promise<
  | { ok: true; user: { uid: string; email: string; decoded: DecodedIdToken } }
  | { ok: false; response: NextResponse }
> {
  const allowed = getAdminInternalEmailSet();
  if (allowed.size === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          errors: [
            {
              field: "config",
              message:
                "Panel administrativo deshabilitado: defina ADMIN_INTERNAL_EMAILS en el servidor (variables de entorno).",
            },
          ],
        },
        { status: 503 },
      ),
    };
  }

  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  if (!isInternalAdminEmail(auth.user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, errors: [{ field: "auth", message: "No autorizado para el panel administrativo." }] },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: auth.user };
}
